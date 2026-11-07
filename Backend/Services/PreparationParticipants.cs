using Microsoft.EntityFrameworkCore;
using TeamCompass.Api.Data;
using TeamCompass.Api.Models;

namespace TeamCompass.Api.Services;

// Wer bei einer Vorbereitung mitläuft. Teilnehmer werden immer live aus der Mannschaft gelesen:
// neue Mitglieder sind automatisch dabei (Gruppe B), wer geht, ist sofort weg.
//
// Sonderregel für Spieler in beiden Herrenmannschaften: Wer in einer Mannschaft "1. …" und in einer
// Mannschaft "2. …" ist, läuft nur bei der 1. Mannschaft mit – aber nur, wenn die 1. Mannschaft eine
// Vorbereitung hat, deren Zeitraum sich mit der der 2. Mannschaft überschneidet. Sonst bleibt er bei
// der 2. Mannschaft. Seine Einträge in der anderen Vorbereitung bleiben gespeichert, werden aber nirgends
// angezeigt oder gezählt.
public static class PreparationParticipants
{
    public static bool IsFirstTeam(string groupName) => groupName.TrimStart().StartsWith("1.");
    public static bool IsSecondTeam(string groupName) => groupName.TrimStart().StartsWith("2.");

    // Spieler-IDs, die bei der Vorbereitung mitmachen.
    public static async Task<HashSet<int>> ResolveAsync(AppDbContext ctx, Preparation prep)
    {
        var members = await ctx.PlayerGroupMemberships
            .Where(m => m.GroupId == prep.GroupId)
            .Select(m => m.PlayerId)
            .ToListAsync();
        var result = members.ToHashSet();
        if (result.Count == 0) return result;

        var groupName = prep.Group?.Name
            ?? await ctx.Groups.Where(g => g.Id == prep.GroupId).Select(g => g.Name).FirstAsync();
        if (!IsSecondTeam(groupName)) return result;

        var overlappingFirstTeams = await OverlappingFirstTeamIdsAsync(ctx, prep);
        if (overlappingFirstTeams.Count == 0) return result;

        var alsoInFirstTeam = await ctx.PlayerGroupMemberships
            .Where(m => overlappingFirstTeams.Contains(m.GroupId) && members.Contains(m.PlayerId))
            .Select(m => m.PlayerId)
            .ToListAsync();
        result.ExceptWith(alsoInFirstTeam);
        return result;
    }

    // Macht genau dieser Spieler bei der Vorbereitung mit? (Für die Spieler-Endpunkte.)
    public static async Task<bool> IsParticipantAsync(AppDbContext ctx, Preparation prep, int playerId)
    {
        if (!await ctx.PlayerGroupMemberships.AnyAsync(m => m.GroupId == prep.GroupId && m.PlayerId == playerId)) return false;

        var groupName = prep.Group?.Name
            ?? await ctx.Groups.Where(g => g.Id == prep.GroupId).Select(g => g.Name).FirstAsync();
        if (!IsSecondTeam(groupName)) return true;

        var overlappingFirstTeams = await OverlappingFirstTeamIdsAsync(ctx, prep);
        if (overlappingFirstTeams.Count == 0) return true;
        return !await ctx.PlayerGroupMemberships.AnyAsync(m => m.PlayerId == playerId && overlappingFirstTeams.Contains(m.GroupId));
    }

    // Gruppe A/B/C je Spieler (ohne Eintrag: B).
    public static async Task<Dictionary<int, string>> PaceGroupsAsync(AppDbContext ctx, int preparationId)
    {
        return await ctx.PreparationAssignments
            .Where(a => a.PreparationId == preparationId)
            .ToDictionaryAsync(a => a.PlayerId, a => a.PaceGroup);
    }

    public static string PaceGroupOf(Dictionary<int, string> paceGroups, int playerId) =>
        paceGroups.GetValueOrDefault(playerId) ?? Preparation.DefaultPaceGroup;

    // Alle Vorbereitungen, bei denen der Spieler mitläuft, mit seinen Einheiten (aktiv und vergangen).
    public static async Task<List<PlayerPreparationView>> ForPlayerAsync(AppDbContext ctx, int playerId, List<int> groupIds, DateTime now)
    {
        var preps = await ctx.Preparations
            .Include(p => p.Group)
            .Include(p => p.Weeks).ThenInclude(w => w.Units)
            .AsSplitQuery()
            .Where(p => groupIds.Contains(p.GroupId))
            .ToListAsync();

        var result = new List<PlayerPreparationView>();
        foreach (var prep in preps)
        {
            if (!await IsParticipantAsync(ctx, prep, playerId)) continue;
            var paceGroup = await ctx.PreparationAssignments
                .Where(a => a.PreparationId == prep.Id && a.PlayerId == playerId)
                .Select(a => a.PaceGroup)
                .FirstOrDefaultAsync() ?? Preparation.DefaultPaceGroup;
            var unitIds = prep.Weeks.SelectMany(w => w.Units).Select(u => u.Id).ToList();
            var entries = await ctx.PreparationEntries
                .Where(e => e.PlayerId == playerId && unitIds.Contains(e.PreparationUnitId))
                .Select(e => new { e.PreparationUnitId, e.Status, e.Confirmed, e.TrainerComment, e.DeclineReason, HasImage = e.Image != null })
                .ToListAsync();

            var units = prep.Weeks.OrderBy(w => w.Number).SelectMany(w => w.Units.OrderBy(u => u.RunNumber).Select(u =>
            {
                var entry = entries.FirstOrDefault(e => e.PreparationUnitId == u.Id);
                return new PlayerPreparationUnitView(
                    u.Id, w.Number, u.RunNumber, w.StartsAt, w.EndsAt, u.DistanceKm, w.PaceFor(paceGroup),
                    PreparationEntry.DisplayStatus(entry?.Status, w.EndsAt, now),
                    entry?.Confirmed ?? false, entry?.TrainerComment, entry?.DeclineReason, entry?.HasImage ?? false);
            })).ToList();
            result.Add(new PlayerPreparationView(prep.Id, prep.Title, prep.Rules, paceGroup, units));
        }
        return result.OrderBy(p => p.Units.Count == 0 ? DateTime.MaxValue : p.Units[0].StartsAt).ToList();
    }

    // IDs der "1."-Mannschaften, die eine Vorbereitung mit überlappendem Zeitraum haben.
    private static async Task<List<int>> OverlappingFirstTeamIdsAsync(AppDbContext ctx, Preparation prep)
    {
        // Wenige Mannschaften – der Namensvergleich läuft bewusst im Speicher.
        var firstTeamIds = (await ctx.Groups.Select(g => new { g.Id, g.Name }).ToListAsync())
            .Where(g => IsFirstTeam(g.Name))
            .Select(g => g.Id)
            .ToList();
        if (firstTeamIds.Count == 0) return firstTeamIds;

        return await ctx.Preparations
            .Where(p => p.Id != prep.Id && firstTeamIds.Contains(p.GroupId)
                && p.StartDate <= prep.EndDate && p.EndDate >= prep.StartDate)
            .Select(p => p.GroupId)
            .Distinct()
            .ToListAsync();
    }
}

public record PlayerPreparationUnitView(
    int Id, int WeekNumber, int RunNumber, DateTime StartsAt, DateTime EndsAt, decimal DistanceKm, int PaceSec,
    string Status, bool Confirmed, string? TrainerComment, string? DeclineReason, bool HasImage);

public record PlayerPreparationView(int Id, string Title, List<string> Rules, string PaceGroup, List<PlayerPreparationUnitView> Units);
