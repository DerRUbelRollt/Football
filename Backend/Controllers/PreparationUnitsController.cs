using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamCompass.Api.Data;
using TeamCompass.Api.Models;
using TeamCompass.Api.Services;

namespace TeamCompass.Api.Controllers;

// Ein einzelnes Vorbereitungs-Ereignis aus Trainer-Sicht: Spielerliste einer Gruppe, Detail eines
// Spielers (Bild, Text, Absage) und Prüfung (Bestätigt / Nicht bestätigt).
[ApiController]
[Route("preparation-units")]
public class PreparationUnitsController : ControllerBase
{
    private readonly AppDbContext _ctx;
    public PreparationUnitsController(AppDbContext ctx) => _ctx = ctx;

    [HttpGet("{unitId:int}")]
    public async Task<IActionResult> Get(int unitId, [FromQuery] string? group)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var paceGroup = (group ?? "").Trim().ToUpperInvariant();
        if (!Preparation.PaceGroups.Contains(paceGroup)) return BadRequest(new { error = "Ungültige Gruppe" });
        var unit = await LoadUnitAsync(unitId);
        if (unit == null) return NotFound(new { error = "Vorbereitungs-Ereignis nicht gefunden" });
        var week = unit.Week!;
        var prep = week.Preparation!;

        var participants = await PreparationParticipants.ResolveAsync(_ctx, prep);
        var paceGroups = await PreparationParticipants.PaceGroupsAsync(_ctx, prep.Id);
        var ids = participants.Where(pid => PreparationParticipants.PaceGroupOf(paceGroups, pid) == paceGroup).ToList();
        var players = await _ctx.Players
            .Where(p => ids.Contains(p.Id))
            .OrderBy(p => p.LastName).ThenBy(p => p.FirstName)
            .Select(p => new { p.Id, p.FirstName, p.LastName, p.PlayerCode })
            .ToListAsync();
        var entries = await _ctx.PreparationEntries
            .Where(e => e.PreparationUnitId == unitId && ids.Contains(e.PlayerId))
            .Select(e => new { e.PlayerId, e.Status, e.Confirmed, e.TrainerComment, HasImage = e.Image != null })
            .ToListAsync();

        var now = DateTime.UtcNow;
        return Ok(new
        {
            id = unit.Id,
            week_number = week.Number,
            run_number = unit.RunNumber,
            starts_at = week.StartsAt,
            ends_at = week.EndsAt,
            distance_km = unit.DistanceKm,
            pace_sec = week.PaceFor(paceGroup),
            pace_group = paceGroup,
            preparation = new { id = prep.Id, title = prep.Title, group = new { id = prep.GroupId, name = prep.Group!.Name } },
            rows = players.Select(p =>
            {
                var entry = entries.FirstOrDefault(e => e.PlayerId == p.Id);
                return new
                {
                    player = new { id = p.Id, first_name = p.FirstName, last_name = p.LastName, player_code = p.PlayerCode },
                    status = PreparationEntry.DisplayStatus(entry?.Status, week.EndsAt, now),
                    confirmed = entry?.Confirmed ?? false,
                    has_image = entry?.HasImage ?? false,
                    // Offen mit Kommentar = vom Trainer nicht bestätigt, wartet auf neue Einreichung.
                    rejected = entry?.Status == PreparationEntry.PendingStatus && entry.TrainerComment != null
                };
            })
        });
    }

    // Detail für den Spieler-Dialog. Das Bild kommt als Data-URL mit – nur hier, nicht in den Listen.
    [HttpGet("{unitId:int}/players/{playerId:int}")]
    public async Task<IActionResult> PlayerDetail(int unitId, int playerId)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var unit = await LoadUnitAsync(unitId);
        if (unit == null) return NotFound(new { error = "Vorbereitungs-Ereignis nicht gefunden" });
        var prep = unit.Week!.Preparation!;
        var player = await _ctx.Players.FirstOrDefaultAsync(p => p.Id == playerId);
        if (player == null) return NotFound(new { error = "Spieler nicht gefunden" });

        var paceGroups = await PreparationParticipants.PaceGroupsAsync(_ctx, prep.Id);
        var entry = await _ctx.PreparationEntries
            .Include(e => e.Image)
            .FirstOrDefaultAsync(e => e.PreparationUnitId == unitId && e.PlayerId == playerId);
        return Ok(EntryView(player, entry, unit.Week!, PreparationParticipants.PaceGroupOf(paceGroups, playerId)));
    }

    [HttpPost("{unitId:int}/players/{playerId:int}/review")]
    public async Task<IActionResult> Review(int unitId, int playerId, [FromBody] ReviewPreparationRequest req)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var entry = await _ctx.PreparationEntries
            .Include(e => e.Image)
            .FirstOrDefaultAsync(e => e.PreparationUnitId == unitId && e.PlayerId == playerId);
        if (entry == null || entry.Status != PreparationEntry.DoneStatus)
            return BadRequest(new { error = "Der Spieler hat diesen Lauf nicht als erledigt gemeldet" });

        var now = DateTime.UtcNow;
        switch (req.Decision)
        {
            case "confirm":
                entry.Confirmed = true;
                entry.TrainerComment = null;
                break;
            case "reject":
                var comment = (req.Comment ?? "").Trim();
                if (comment.Length == 0) return BadRequest(new { error = "Bitte schreib dem Spieler einen Kommentar" });
                if (comment.Length > 500) return BadRequest(new { error = "Der Kommentar ist zu lang (max. 500 Zeichen)" });
                // Zurück auf offen: der Spieler sieht den Kommentar und kann neu einreichen, solange die Woche läuft.
                entry.Status = PreparationEntry.PendingStatus;
                entry.Confirmed = false;
                entry.Description = null;
                entry.DeclineReason = null;
                entry.SubmittedAt = null;
                entry.TrainerComment = comment;
                break;
            default:
                return BadRequest(new { error = "Ungültige Entscheidung" });
        }
        // Nach der Prüfung wird das Bild nicht mehr gebraucht – Speicher sparen.
        if (entry.Image != null) _ctx.PreparationEntryImages.Remove(entry.Image);
        entry.ReviewedAt = now;
        entry.UpdatedAt = now;
        await _ctx.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    private Task<PreparationUnit?> LoadUnitAsync(int unitId) => _ctx.PreparationUnits
        .Include(u => u.Week).ThenInclude(w => w!.Preparation).ThenInclude(p => p!.Group)
        .FirstOrDefaultAsync(u => u.Id == unitId);

    // Gemeinsame Ansicht eines Eintrags für Trainer-Dialog und Lese-Dialog des Spielers.
    public static object EntryView(Player player, PreparationEntry? entry, PreparationWeek week, string paceGroup)
    {
        var now = DateTime.UtcNow;
        return new
        {
            player = new { id = player.Id, first_name = player.FirstName, last_name = player.LastName },
            pace_group = paceGroup,
            status = PreparationEntry.DisplayStatus(entry?.Status, week.EndsAt, now),
            confirmed = entry?.Confirmed ?? false,
            description = entry?.Description,
            decline_reason = entry?.DeclineReason,
            trainer_comment = entry?.TrainerComment,
            submitted_at = entry?.SubmittedAt,
            reviewed_at = entry?.ReviewedAt,
            image = entry?.Image == null ? null : PreparationImages.ToDataUrl(entry.Image.Data, entry.Image.ContentType),
            // Erledigt, aber ohne Bild: nach der Prüfung oder 14 Tage nach Wochenende gelöscht.
            image_removed = entry?.Status == PreparationEntry.DoneStatus && entry.Image == null,
            week_ended = now >= week.EndsAt
        };
    }
}

public record ReviewPreparationRequest(string Decision, string? Comment);
