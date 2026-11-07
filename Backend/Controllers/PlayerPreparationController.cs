using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamCompass.Api.Data;
using TeamCompass.Api.Models;
using TeamCompass.Api.Services;

namespace TeamCompass.Api.Controllers;

// Spieler-Sicht auf Vorbereitungs-Ereignisse: Lauf als erledigt melden (mit Screenshot), absagen
// (mit Begründung) und den eigenen Lauf ansehen. Melden und Absagen gehen nur, solange die Woche läuft.
[ApiController]
[Route("player/preparation")]
public class PlayerPreparationController : ControllerBase
{
    private readonly AppDbContext _ctx;
    public PlayerPreparationController(AppDbContext ctx) => _ctx = ctx;

    [HttpPost("done")]
    public async Task<IActionResult> Done([FromBody] PreparationDoneRequest req)
    {
        var (player, unit, error) = await LoadAsync(req.Code, req.UnitId);
        if (error != null) return error;
        if (WindowError(unit!.Week!) is { } windowError) return BadRequest(new { error = windowError });
        if (!PreparationImages.TryParse(req.Image, out var data, out var contentType, out var imageError))
            return BadRequest(new { error = imageError });
        var description = (req.Description ?? "").Trim();
        if (description.Length > 1000) return BadRequest(new { error = "Die Beschreibung ist zu lang (max. 1000 Zeichen)" });

        var entry = await _ctx.PreparationEntries
            .Include(e => e.Image)
            .FirstOrDefaultAsync(e => e.PreparationUnitId == unit.Id && e.PlayerId == player!.Id);
        if (entry?.Status == PreparationEntry.DoneStatus)
            return Conflict(new { error = "Du hast diesen Lauf bereits als erledigt gemeldet" });
        if (entry == null)
        {
            entry = new PreparationEntry { PreparationUnitId = unit.Id, PlayerId = player!.Id };
            _ctx.PreparationEntries.Add(entry);
        }

        var now = DateTime.UtcNow;
        // Auch nach einer Absage erlaubt – dann zählt der Lauf als erledigt.
        entry.Status = PreparationEntry.DoneStatus;
        entry.Description = description.Length == 0 ? null : description;
        entry.DeclineReason = null;
        entry.TrainerComment = null;
        entry.Confirmed = false;
        entry.SubmittedAt = now;
        entry.ReviewedAt = null;
        entry.UpdatedAt = now;
        if (entry.Image == null) entry.Image = new PreparationEntryImage { Data = data, ContentType = contentType };
        else
        {
            entry.Image.Data = data;
            entry.Image.ContentType = contentType;
        }
        await _ctx.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    [HttpPost("decline")]
    public async Task<IActionResult> Decline([FromBody] PreparationDeclineRequest req)
    {
        var (player, unit, error) = await LoadAsync(req.Code, req.UnitId);
        if (error != null) return error;
        if (WindowError(unit!.Week!) is { } windowError) return BadRequest(new { error = windowError });
        var reason = (req.Reason ?? "").Trim();
        if (reason.Length < 3) return BadRequest(new { error = "Bitte gib eine Begründung an" });
        if (reason.Length > 500) return BadRequest(new { error = "Die Begründung ist zu lang (max. 500 Zeichen)" });

        var entry = await _ctx.PreparationEntries
            .FirstOrDefaultAsync(e => e.PreparationUnitId == unit.Id && e.PlayerId == player!.Id);
        if (entry?.Status == PreparationEntry.DoneStatus) return Conflict(new { error = "Du hast diesen Lauf bereits als erledigt gemeldet" });
        if (entry?.Status == PreparationEntry.DeclinedStatus) return Conflict(new { error = "Du hast bereits abgesagt" });
        if (entry == null)
        {
            entry = new PreparationEntry { PreparationUnitId = unit.Id, PlayerId = player!.Id };
            _ctx.PreparationEntries.Add(entry);
        }

        var now = DateTime.UtcNow;
        entry.Status = PreparationEntry.DeclinedStatus;
        entry.DeclineReason = reason;
        entry.TrainerComment = null;
        entry.SubmittedAt = now;
        entry.UpdatedAt = now;
        await _ctx.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // Eigenen Lauf nur lesen (Bild, solange es noch nicht gelöscht ist).
    [HttpPost("entry")]
    public async Task<IActionResult> Entry([FromBody] PreparationEntryRequest req)
    {
        var (player, unit, error) = await LoadAsync(req.Code, req.UnitId);
        if (error != null) return error;
        var prepId = unit!.Week!.PreparationId;
        var paceGroup = await _ctx.PreparationAssignments
            .Where(a => a.PreparationId == prepId && a.PlayerId == player!.Id)
            .Select(a => a.PaceGroup)
            .FirstOrDefaultAsync() ?? Preparation.DefaultPaceGroup;
        var entry = await _ctx.PreparationEntries
            .Include(e => e.Image)
            .FirstOrDefaultAsync(e => e.PreparationUnitId == unit.Id && e.PlayerId == player!.Id);
        return Ok(PreparationUnitsController.EntryView(player!, entry, unit.Week, paceGroup));
    }

    private async Task<(Player? player, PreparationUnit? unit, IActionResult? error)> LoadAsync(string code, int unitId)
    {
        var player = await _ctx.Players.FirstOrDefaultAsync(p => p.PlayerCode == (code ?? "").ToUpper());
        if (player == null) return (null, null, NotFound(new { error = "Ungültige Spieler-ID" }));
        var unit = await _ctx.PreparationUnits
            .Include(u => u.Week).ThenInclude(w => w!.Preparation).ThenInclude(p => p!.Group)
            .FirstOrDefaultAsync(u => u.Id == unitId);
        if (unit == null) return (player, null, NotFound(new { error = "Vorbereitungs-Ereignis nicht gefunden" }));
        if (!await PreparationParticipants.IsParticipantAsync(_ctx, unit.Week!.Preparation!, player.Id))
            return (player, unit, Unauthorized(new { error = "Nicht deine Vorbereitung" }));
        return (player, unit, null);
    }

    private static string? WindowError(PreparationWeek week)
    {
        var now = DateTime.UtcNow;
        if (now < week.StartsAt) return "Diese Woche hat noch nicht begonnen";
        if (now >= week.EndsAt) return "Diese Woche ist bereits vorbei";
        return null;
    }
}

public record PreparationDoneRequest(string Code, int UnitId, string Image, string? Description = null);
public record PreparationDeclineRequest(string Code, int UnitId, string Reason);
public record PreparationEntryRequest(string Code, int UnitId);
