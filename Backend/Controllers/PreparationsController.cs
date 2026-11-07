using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamCompass.Api.Data;
using TeamCompass.Api.Models;
using TeamCompass.Api.Services;

namespace TeamCompass.Api.Controllers;

// Trainer-Sicht auf Fitness-Vorbereitungen (Tab "Vorbereitung"): anlegen, bearbeiten, löschen,
// Spieler den Gruppen A/B/C zuordnen und die Ereignisse einer Gruppe auflisten.
[ApiController]
[Route("preparations")]
public class PreparationsController : ControllerBase
{
    private readonly AppDbContext _ctx;
    public PreparationsController(AppDbContext ctx) => _ctx = ctx;

    [HttpGet]
    public async Task<IActionResult> List()
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var preps = await _ctx.Preparations
            .Include(p => p.Group)
            .Include(p => p.Weeks).ThenInclude(w => w.Units)
            .AsSplitQuery()
            .OrderByDescending(p => p.StartDate).ThenByDescending(p => p.Id)
            .ToListAsync();
        var openReviews = await _ctx.PreparationEntries
            .Where(e => e.Status == PreparationEntry.DoneStatus && !e.Confirmed)
            .Select(e => new { e.Unit!.Week!.PreparationId, e.PlayerId })
            .ToListAsync();

        var now = DateTime.UtcNow;
        var rows = new List<object>();
        foreach (var p in preps)
        {
            var participants = await PreparationParticipants.ResolveAsync(_ctx, p);
            var toReview = openReviews.Count(r => r.PreparationId == p.Id && participants.Contains(r.PlayerId));
            rows.Add(Summary(p, participants.Count, toReview, now));
        }
        return Ok(rows);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePreparationRequest req)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        if (ValidateTitle(req.Title) is { } titleError) return BadRequest(new { error = titleError });
        if (!await _ctx.Groups.AnyAsync(g => g.Id == req.GroupId)) return NotFound(new { error = "Mannschaft nicht gefunden" });
        if (req.EndDate < req.StartDate) return BadRequest(new { error = "Das Enddatum darf nicht vor dem Startdatum liegen" });
        if (req.RunsPerWeek is < 1 or > Preparation.MaxRunsPerWeek)
            return BadRequest(new { error = $"Bitte 1 bis {Preparation.MaxRunsPerWeek} Läufe pro Woche angeben" });

        var expectedWeeks = WeeksBetween(req.StartDate, req.EndDate);
        if (expectedWeeks > Preparation.MaxWeeks)
            return BadRequest(new { error = $"Eine Vorbereitung darf höchstens {Preparation.MaxWeeks} Wochen lang sein" });
        var weeks = req.Weeks ?? new List<PreparationWeekInput>();
        if (weeks.Count != expectedWeeks) return BadRequest(new { error = "Die Wochen passen nicht zum Zeitraum – bitte den Dialog neu öffnen" });

        var previousEnd = DateTime.MinValue;
        for (var i = 0; i < weeks.Count; i++)
        {
            var starts = weeks[i].StartsAt.ToUniversalTime();
            var ends = weeks[i].EndsAt.ToUniversalTime();
            if (ends <= starts || starts < previousEnd) return BadRequest(new { error = "Ungültige Wochen-Zeiträume" });
            previousEnd = ends;
            if (ValidateWeekPlan(weeks[i].DistancesKm, weeks[i].PaceASec, weeks[i].PaceBSec, weeks[i].PaceCSec, req.RunsPerWeek, i + 1) is { } planError)
                return BadRequest(new { error = planError });
        }
        if (NormalizeRules(req.Rules, out var rules) is { } rulesError) return BadRequest(new { error = rulesError });

        var prep = new Preparation
        {
            Title = req.Title.Trim(),
            GroupId = req.GroupId,
            StartDate = req.StartDate,
            EndDate = req.EndDate,
            RunsPerWeek = req.RunsPerWeek,
            Rules = rules,
            CreatedAt = DateTime.UtcNow,
            Weeks = weeks.Select((w, i) => new PreparationWeek
            {
                Number = i + 1,
                StartsAt = w.StartsAt.ToUniversalTime(),
                EndsAt = w.EndsAt.ToUniversalTime(),
                PaceASec = w.PaceASec,
                PaceBSec = w.PaceBSec,
                PaceCSec = w.PaceCSec,
                Units = w.DistancesKm.Select((d, r) => new PreparationUnit { RunNumber = r + 1, DistanceKm = Math.Round(d, 2) }).ToList()
            }).ToList()
        };
        _ctx.Preparations.Add(prep);
        await _ctx.SaveChangesAsync();
        return Ok(new { id = prep.Id, count = prep.Weeks.Sum(w => w.Units.Count) });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var p = await LoadAsync(id);
        if (p == null) return NotFound(new { error = "Vorbereitung nicht gefunden" });

        var participants = await PreparationParticipants.ResolveAsync(_ctx, p);
        var paceGroups = await PreparationParticipants.PaceGroupsAsync(_ctx, id);
        var unitIds = p.Weeks.SelectMany(w => w.Units).Select(u => u.Id).ToList();
        var toReview = (await _ctx.PreparationEntries
                .Where(e => unitIds.Contains(e.PreparationUnitId) && e.Status == PreparationEntry.DoneStatus && !e.Confirmed)
                .Select(e => e.PlayerId)
                .ToListAsync())
            .Where(participants.Contains)
            .ToList();

        var groupStats = Preparation.PaceGroups.ToDictionary(g => g, g => new
        {
            players = participants.Count(pid => PreparationParticipants.PaceGroupOf(paceGroups, pid) == g),
            to_review = toReview.Count(pid => PreparationParticipants.PaceGroupOf(paceGroups, pid) == g)
        });

        var now = DateTime.UtcNow;
        return Ok(new
        {
            id = p.Id,
            title = p.Title,
            group = new { id = p.GroupId, name = p.Group!.Name },
            start_date = p.StartDate,
            end_date = p.EndDate,
            runs_per_week = p.RunsPerWeek,
            weeks_count = p.Weeks.Count,
            units_count = unitIds.Count,
            player_count = participants.Count,
            to_review = toReview.Count,
            ended = IsEnded(p, now),
            rules = p.Rules,
            weeks = p.Weeks.OrderBy(w => w.Number).Select(w => new
            {
                number = w.Number,
                starts_at = w.StartsAt,
                ends_at = w.EndsAt,
                pace = PaceMap(w),
                units = w.Units.OrderBy(u => u.RunNumber).Select(u => new { id = u.Id, run_number = u.RunNumber, distance_km = u.DistanceKm })
            }),
            pace_groups = groupStats
        });
    }

    // Name, Distanzen, Pace und Regeln lassen sich ändern. Mannschaft, Zeitraum und Läufe pro Woche
    // sind fest, weil sonst Ereignisse mit Einreichungen wegfallen würden.
    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdatePreparationRequest req)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var p = await LoadAsync(id);
        if (p == null) return NotFound(new { error = "Vorbereitung nicht gefunden" });
        if (ValidateTitle(req.Title) is { } titleError) return BadRequest(new { error = titleError });

        var weeks = p.Weeks.OrderBy(w => w.Number).ToList();
        var input = req.Weeks ?? new List<PreparationWeekPlanInput>();
        if (input.Count != weeks.Count) return BadRequest(new { error = "Die Wochen passen nicht zur Vorbereitung – bitte neu laden" });
        for (var i = 0; i < input.Count; i++)
        {
            if (ValidateWeekPlan(input[i].DistancesKm, input[i].PaceASec, input[i].PaceBSec, input[i].PaceCSec, p.RunsPerWeek, i + 1) is { } planError)
                return BadRequest(new { error = planError });
        }
        if (NormalizeRules(req.Rules, out var rules) is { } rulesError) return BadRequest(new { error = rulesError });

        p.Title = req.Title.Trim();
        p.Rules = rules;
        for (var i = 0; i < weeks.Count; i++)
        {
            weeks[i].PaceASec = input[i].PaceASec;
            weeks[i].PaceBSec = input[i].PaceBSec;
            weeks[i].PaceCSec = input[i].PaceCSec;
            var units = weeks[i].Units.OrderBy(u => u.RunNumber).ToList();
            for (var r = 0; r < units.Count; r++) units[r].DistanceKm = Math.Round(input[i].DistancesKm[r], 2);
        }
        await _ctx.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var p = await _ctx.Preparations.FirstOrDefaultAsync(x => x.Id == id);
        if (p == null) return NotFound(new { error = "Vorbereitung nicht gefunden" });
        // Wochen, Ereignisse, Zuordnungen, Einträge und Bilder gehen per Cascade mit.
        _ctx.Preparations.Remove(p);
        await _ctx.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // Alle Teilnehmer mit ihrer Gruppe – für "Gruppen einteilen".
    [HttpGet("{id:int}/players")]
    public async Task<IActionResult> Players(int id)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var p = await _ctx.Preparations.Include(x => x.Group).FirstOrDefaultAsync(x => x.Id == id);
        if (p == null) return NotFound(new { error = "Vorbereitung nicht gefunden" });

        var participantIds = (await PreparationParticipants.ResolveAsync(_ctx, p)).ToList();
        var paceGroups = await PreparationParticipants.PaceGroupsAsync(_ctx, id);
        var players = await _ctx.Players
            .Where(pl => participantIds.Contains(pl.Id))
            .OrderBy(pl => pl.LastName).ThenBy(pl => pl.FirstName)
            .Select(pl => new { pl.Id, pl.FirstName, pl.LastName, pl.PlayerCode })
            .ToListAsync();
        return Ok(players.Select(pl => new
        {
            id = pl.Id,
            first_name = pl.FirstName,
            last_name = pl.LastName,
            player_code = pl.PlayerCode,
            pace_group = PreparationParticipants.PaceGroupOf(paceGroups, pl.Id)
        }));
    }

    [HttpPut("{id:int}/players/{playerId:int}/group")]
    public async Task<IActionResult> SetPaceGroup(int id, int playerId, [FromBody] SetPaceGroupRequest req)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var group = (req.Group ?? "").Trim().ToUpperInvariant();
        if (!Preparation.PaceGroups.Contains(group)) return BadRequest(new { error = "Ungültige Gruppe" });
        var p = await _ctx.Preparations.Include(x => x.Group).FirstOrDefaultAsync(x => x.Id == id);
        if (p == null) return NotFound(new { error = "Vorbereitung nicht gefunden" });
        if (!await PreparationParticipants.IsParticipantAsync(_ctx, p, playerId))
            return NotFound(new { error = "Der Spieler nimmt an dieser Vorbereitung nicht teil" });

        var assignment = await _ctx.PreparationAssignments.FirstOrDefaultAsync(a => a.PreparationId == id && a.PlayerId == playerId);
        if (assignment == null)
        {
            assignment = new PreparationAssignment { PreparationId = id, PlayerId = playerId };
            _ctx.PreparationAssignments.Add(assignment);
        }
        assignment.PaceGroup = group;
        await _ctx.SaveChangesAsync();
        return Ok(new { ok = true, pace_group = group });
    }

    // Ordner einer Gruppe: alle Ereignisse mit den Zählern der Spieler dieser Gruppe.
    [HttpGet("{id:int}/groups/{group}")]
    public async Task<IActionResult> GroupUnits(int id, string group)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        group = group.Trim().ToUpperInvariant();
        if (!Preparation.PaceGroups.Contains(group)) return BadRequest(new { error = "Ungültige Gruppe" });
        var p = await LoadAsync(id);
        if (p == null) return NotFound(new { error = "Vorbereitung nicht gefunden" });

        var participants = await PreparationParticipants.ResolveAsync(_ctx, p);
        var paceGroups = await PreparationParticipants.PaceGroupsAsync(_ctx, id);
        var players = participants.Where(pid => PreparationParticipants.PaceGroupOf(paceGroups, pid) == group).ToList();
        var unitIds = p.Weeks.SelectMany(w => w.Units).Select(u => u.Id).ToList();
        var entries = await _ctx.PreparationEntries
            .Where(e => unitIds.Contains(e.PreparationUnitId) && players.Contains(e.PlayerId))
            .Select(e => new { e.PreparationUnitId, e.Status, e.Confirmed })
            .ToListAsync();

        var now = DateTime.UtcNow;
        var units = p.Weeks.OrderBy(w => w.Number).SelectMany(w => w.Units.OrderBy(u => u.RunNumber).Select(u =>
        {
            var unitEntries = entries.Where(e => e.PreparationUnitId == u.Id).ToList();
            var done = unitEntries.Count(e => e.Status == PreparationEntry.DoneStatus);
            var declined = unitEntries.Count(e => e.Status == PreparationEntry.DeclinedStatus);
            var open = players.Count - done - declined;
            var ended = now >= w.EndsAt;
            return new
            {
                id = u.Id,
                week_number = w.Number,
                run_number = u.RunNumber,
                starts_at = w.StartsAt,
                ends_at = w.EndsAt,
                distance_km = u.DistanceKm,
                pace_sec = w.PaceFor(group),
                total = players.Count,
                done,
                // Nach Wochenende zählt, wer nichts gemeldet hat, als "Nicht erledigt".
                not_done = declined + (ended ? open : 0),
                open = ended ? 0 : open,
                to_review = unitEntries.Count(e => e.Status == PreparationEntry.DoneStatus && !e.Confirmed)
            };
        })).ToList();

        return Ok(new
        {
            preparation = new { id = p.Id, title = p.Title, group = new { id = p.GroupId, name = p.Group!.Name } },
            pace_group = group,
            players = players.Count,
            units
        });
    }

    private Task<Preparation?> LoadAsync(int id) => _ctx.Preparations
        .Include(p => p.Group)
        .Include(p => p.Weeks).ThenInclude(w => w.Units)
        .AsSplitQuery()
        .FirstOrDefaultAsync(p => p.Id == id);

    private static object Summary(Preparation p, int playerCount, int toReview, DateTime now) => new
    {
        id = p.Id,
        title = p.Title,
        group = new { id = p.GroupId, name = p.Group!.Name },
        start_date = p.StartDate,
        end_date = p.EndDate,
        runs_per_week = p.RunsPerWeek,
        weeks_count = p.Weeks.Count,
        units_count = p.Weeks.Sum(w => w.Units.Count),
        player_count = playerCount,
        to_review = toReview,
        ended = IsEnded(p, now)
    };

    private static bool IsEnded(Preparation p, DateTime now) => p.Weeks.Count > 0 && p.Weeks.Max(w => w.EndsAt) <= now;

    // Schlüssel "A"/"B"/"C" als Dictionary, damit die JSON-Benennung sie nicht klein schreibt.
    private static Dictionary<string, int> PaceMap(PreparationWeek w) =>
        Preparation.PaceGroups.ToDictionary(g => g, w.PaceFor);

    // Anzahl Kalenderwochen (Mo–So), die der Zeitraum berührt.
    private static int WeeksBetween(DateOnly start, DateOnly end) =>
        (MondayOf(end).DayNumber - MondayOf(start).DayNumber) / 7 + 1;

    private static DateOnly MondayOf(DateOnly d) => d.AddDays(-(((int)d.DayOfWeek + 6) % 7));

    private static string? ValidateTitle(string? title)
    {
        var t = (title ?? "").Trim();
        if (t.Length == 0) return "Bitte gib der Vorbereitung einen Namen";
        if (t.Length > 60) return "Der Name ist zu lang (max. 60 Zeichen)";
        return null;
    }

    private static string? ValidateWeekPlan(List<decimal>? distances, int paceA, int paceB, int paceC, int runsPerWeek, int weekNumber)
    {
        if (distances == null || distances.Count != runsPerWeek) return $"Woche {weekNumber}: bitte für jeden Lauf eine Distanz angeben";
        if (distances.Any(d => d < 0.5m || d > 50m)) return $"Woche {weekNumber}: Distanzen müssen zwischen 0,5 und 50 km liegen";
        if (new[] { paceA, paceB, paceC }.Any(s => s < 180 || s > 720)) return $"Woche {weekNumber}: Pace muss zwischen 3:00 und 12:00 min/km liegen";
        return null;
    }

    private static string? NormalizeRules(List<string>? input, out List<string> rules)
    {
        rules = (input ?? new List<string>()).Select(r => (r ?? "").Trim()).Where(r => r.Length > 0).ToList();
        if (rules.Count > Preparation.MaxRules) return $"Maximal {Preparation.MaxRules} Regeln";
        if (rules.Any(r => r.Length > 200)) return "Eine Regel ist zu lang (max. 200 Zeichen)";
        return null;
    }
}

public record PreparationWeekInput(DateTime StartsAt, DateTime EndsAt, List<decimal> DistancesKm, int PaceASec, int PaceBSec, int PaceCSec);
public record PreparationWeekPlanInput(List<decimal> DistancesKm, int PaceASec, int PaceBSec, int PaceCSec);
public record CreatePreparationRequest(string Title, int GroupId, DateOnly StartDate, DateOnly EndDate, int RunsPerWeek, List<string>? Rules, List<PreparationWeekInput>? Weeks);
public record UpdatePreparationRequest(string Title, List<string>? Rules, List<PreparationWeekPlanInput>? Weeks);
public record SetPaceGroupRequest(string Group);
