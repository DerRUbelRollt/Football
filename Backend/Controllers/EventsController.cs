using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamCompass.Api.Data;
using TeamCompass.Api.Models;
using TeamCompass.Api.Services;

namespace TeamCompass.Api.Controllers;

[ApiController]
[Route("events")]
public class EventsController : ControllerBase
{
    private readonly AppDbContext _ctx;
    public EventsController(AppDbContext ctx) => _ctx = ctx;

    [HttpGet]
    public async Task<IActionResult> List()
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var events = await _ctx.Events
            .Include(e => e.Group)
            .OrderByDescending(e => e.EventAt)
            .Select(e => new
            {
                id = e.Id,
                event_type = e.EventType,
                title = e.Title,
                opponent = e.Opponent,
                home_away = e.HomeAway,
                location = e.Location,
                event_at = e.EventAt,
                groups = e.Group == null ? null : new { name = e.Group.Name }
            })
            .ToListAsync();
        return Ok(events);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] List<CreateEventRequest> rows)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        if (rows.Count == 0) return BadRequest(new { error = "Keine Ereignisse übergeben" });
        if (rows.Count > 60) return BadRequest(new { error = "Zu viele Ereignisse auf einmal" });

        var groupIds = rows.Select(r => r.GroupId).Distinct().ToList();
        var existing = await _ctx.Groups.Where(g => groupIds.Contains(g.Id)).Select(g => g.Id).ToListAsync();
        if (existing.Count != groupIds.Count) return NotFound(new { error = "Mannschaft nicht gefunden" });

        var playersByGroup = await _ctx.PlayerGroupMemberships
            .Where(m => groupIds.Contains(m.GroupId))
            .GroupBy(m => m.GroupId)
            .ToDictionaryAsync(g => g.Key, g => g.Select(m => m.PlayerId).ToList());

        var now = DateTime.UtcNow;
        foreach (var row in rows)
        {
            if (string.IsNullOrWhiteSpace(row.Title)) return BadRequest(new { error = "Titel ist erforderlich" });
            if (row.EventType != "training" && row.EventType != "game") return BadRequest(new { error = "Ungültiger Ereignistyp" });

            var ev = new Event
            {
                EventType = row.EventType,
                Title = row.Title.Trim(),
                Opponent = string.IsNullOrWhiteSpace(row.Opponent) ? null : row.Opponent.Trim(),
                HomeAway = string.IsNullOrWhiteSpace(row.HomeAway) ? null : row.HomeAway,
                Location = string.IsNullOrWhiteSpace(row.Location) ? null : row.Location.Trim(),
                MeetingPoint = string.IsNullOrWhiteSpace(row.MeetingPoint) ? null : row.MeetingPoint.Trim(),
                EventAt = row.EventAt.ToUniversalTime(),
                Description = string.IsNullOrWhiteSpace(row.Description) ? null : row.Description.Trim(),
                GroupId = row.GroupId
            };
            _ctx.Events.Add(ev);

            // Offene Anwesenheiten für alle Spieler der Mannschaft anlegen,
            // damit die Teilnehmerliste des Ereignisses vollständig ist.
            foreach (var playerId in playersByGroup.GetValueOrDefault(row.GroupId) ?? new List<int>())
            {
                _ctx.Attendances.Add(new Attendance { Event = ev, PlayerId = playerId, Status = "pending", UpdatedAt = now });
            }
        }

        await _ctx.SaveChangesAsync();
        return Ok(new { count = rows.Count });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var e = await _ctx.Events.Include(ev => ev.Group).FirstOrDefaultAsync(ev => ev.Id == id);
        if (e == null) return NotFound(new { error = "Ereignis nicht gefunden" });
        return Ok(new
        {
            id = e.Id,
            event_type = e.EventType,
            title = e.Title,
            opponent = e.Opponent,
            home_away = e.HomeAway,
            home_score = e.HomeScore,
            away_score = e.AwayScore,
            location = e.Location,
            meeting_point = e.MeetingPoint,
            event_at = e.EventAt,
            description = e.Description,
            group_id = e.GroupId,
            groups = e.Group == null ? null : new { name = e.Group.Name }
        });
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateEventRequest req)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var e = await _ctx.Events.FirstOrDefaultAsync(ev => ev.Id == id);
        if (e == null) return NotFound(new { error = "Ereignis nicht gefunden" });
        if (string.IsNullOrWhiteSpace(req.Title)) return BadRequest(new { error = "Titel ist erforderlich" });

        // Der Ereignistyp (Training/Spiel) ist nach dem Erstellen fest.
        var isGame = e.EventType == "game";
        e.Title = req.Title.Trim();
        e.Opponent = isGame && !string.IsNullOrWhiteSpace(req.Opponent) ? req.Opponent.Trim() : null;
        e.HomeAway = isGame && !string.IsNullOrWhiteSpace(req.HomeAway) ? req.HomeAway : null;
        e.Location = string.IsNullOrWhiteSpace(req.Location) ? null : req.Location.Trim();
        e.MeetingPoint = string.IsNullOrWhiteSpace(req.MeetingPoint) ? null : req.MeetingPoint.Trim();
        e.EventAt = req.EventAt.ToUniversalTime();
        e.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();

        if (req.GroupId != e.GroupId)
        {
            if (!await _ctx.Groups.AnyAsync(g => g.Id == req.GroupId)) return NotFound(new { error = "Mannschaft nicht gefunden" });

            // Teilnehmerliste an die neue Mannschaft anpassen: Nicht-Mitglieder entfernen,
            // fehlende Mitglieder offen eintragen. Rückmeldungen von Spielern in beiden Mannschaften bleiben.
            var memberIds = await _ctx.PlayerGroupMemberships
                .Where(m => m.GroupId == req.GroupId)
                .Select(m => m.PlayerId)
                .ToListAsync();
            var attendances = await _ctx.Attendances.Where(a => a.EventId == id).ToListAsync();
            _ctx.Attendances.RemoveRange(attendances.Where(a => !memberIds.Contains(a.PlayerId)));

            var now = DateTime.UtcNow;
            var invited = attendances.Select(a => a.PlayerId).ToHashSet();
            foreach (var playerId in memberIds.Where(p => !invited.Contains(p)))
            {
                _ctx.Attendances.Add(new Attendance { EventId = id, PlayerId = playerId, Status = "pending", UpdatedAt = now });
            }
            e.GroupId = req.GroupId;
        }

        await _ctx.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var e = await _ctx.Events.FirstOrDefaultAsync(ev => ev.Id == id);
        if (e == null) return NotFound(new { error = "Ereignis nicht gefunden" });
        _ctx.Events.Remove(e);
        await _ctx.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    [HttpPatch("{id:int}/result")]
    public async Task<IActionResult> SetResult(int id, [FromBody] SetResultRequest req)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var e = await _ctx.Events.FirstOrDefaultAsync(ev => ev.Id == id);
        if (e == null) return NotFound(new { error = "Ereignis nicht gefunden" });
        if (e.EventType != "game") return BadRequest(new { error = "Ergebnis nur bei Spielen möglich" });

        e.HomeScore = req.HomeScore;
        e.AwayScore = req.AwayScore;
        await _ctx.SaveChangesAsync();
        return Ok(new { ok = true, home_score = e.HomeScore, away_score = e.AwayScore });
    }

    [HttpGet("{id:int}/attendances")]
    public async Task<IActionResult> Attendances(int id)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var rows = await _ctx.Attendances
            .Where(a => a.EventId == id)
            .Include(a => a.Player)
            .OrderBy(a => a.Player!.LastName).ThenBy(a => a.Player!.FirstName)
            .Select(a => new
            {
                id = a.Id,
                status = a.Status,
                players = a.Player == null ? null : new
                {
                    id = a.Player.Id,
                    first_name = a.Player.FirstName,
                    last_name = a.Player.LastName,
                    player_code = a.Player.PlayerCode
                }
            })
            .ToListAsync();
        return Ok(rows);
    }
}

public record CreateEventRequest(
    string EventType,
    string Title,
    string? Opponent,
    string? HomeAway,
    string? Location,
    string? MeetingPoint,
    DateTime EventAt,
    string? Description,
    int GroupId);

public record UpdateEventRequest(
    string Title,
    string? Opponent,
    string? HomeAway,
    string? Location,
    string? MeetingPoint,
    DateTime EventAt,
    string? Description,
    int GroupId);

public record SetResultRequest(int? HomeScore, int? AwayScore);
