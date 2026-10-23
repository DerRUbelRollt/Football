using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamCompass.Api.Data;
using TeamCompass.Api.Models;
using TeamCompass.Api.Services;

namespace TeamCompass.Api.Controllers;

[ApiController]
[Route("stats")]
public class StatsController : ControllerBase
{
    private readonly AppDbContext _ctx;
    public StatsController(AppDbContext ctx) => _ctx = ctx;

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard()
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });

        var now = DateTime.UtcNow;
        var groups = await _ctx.Groups.CountAsync();
        var players = await _ctx.Players.CountAsync();
        // Einzelgespräche haben im Dashboard ein eigenes Fenster (siehe meetings).
        var upcoming = await _ctx.Events
            .Include(e => e.Group)
            .Where(e => e.EventAt >= now && e.EventType != Event.MeetingType)
            .OrderBy(e => e.EventAt)
            .Take(5)
            .Select(e => new
            {
                id = e.Id,
                event_type = e.EventType,
                title = e.Title,
                opponent = e.Opponent,
                event_at = e.EventAt,
                groups = e.Group == null ? null : new { name = e.Group.Name }
            })
            .ToListAsync();

        var trainingAttendances = _ctx.Attendances.Where(a => a.Event!.EventType == "training");
        var total = await trainingAttendances.CountAsync();
        var accepted = await trainingAttendances.CountAsync(a => a.Status == "accepted");
        var rate = total > 0 ? (int)Math.Round(accepted * 100.0 / total) : 0;

        // Aktuelle Einzelgespräche: festgelegte (grün) ganz oben nach gewähltem Termin, dann offene (orange),
        // dann "Keiner passt" (rot), jeweils nach dem ersten Vorschlag. Ob ein Gespräch noch aktuell ist,
        // hängt vom letzten Vorschlag ab – das wird im Speicher geprüft (es sind nur wenige Gespräche).
        var meetingEvents = await _ctx.Events.Include(e => e.Player).Where(e => e.EventType == Event.MeetingType).ToListAsync();
        var meetingAnswers = await _ctx.Attendances
            .Where(a => a.Event!.EventType == Event.MeetingType)
            .Select(a => new { a.EventId, a.Status })
            .ToListAsync();
        var meetings = meetingEvents
            .Select(e => new { Event = e, Status = Event.MeetingStatusOf(meetingAnswers.FirstOrDefault(a => a.EventId == e.Id)?.Status) })
            .Where(m => now < m.Event.MeetingActiveUntil(m.Status == "confirmed"))
            .OrderBy(m => m.Status switch { "confirmed" => 0, "open" => 1, _ => 2 })
            .ThenBy(m => m.Event.EventAt)
            .Select(m => new
            {
                id = m.Event.Id,
                title = m.Event.Title,
                location = m.Event.Location,
                event_at = m.Event.EventAt,
                proposed_times = m.Event.ProposedTimes,
                meeting_status = m.Status,
                player = m.Event.Player == null ? null : new { first_name = m.Event.Player.FirstName, last_name = m.Event.Player.LastName }
            })
            .ToList();

        return Ok(new { groups, players, upcoming, rate, meetings });
    }

    [HttpGet("attendance")]
    public async Task<IActionResult> Attendance()
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });

        // Nur Trainings zaehlen - Spiele sollen nicht in die Anwesenheitsstatistik einfliessen.
        var rows = await _ctx.Attendances
            .Include(a => a.Player)
            .Include(a => a.Event)
            .Where(a => a.Event!.EventType == "training")
            .Select(a => new
            {
                status = a.Status,
                players = a.Player == null ? null : new { id = a.Player.Id, first_name = a.Player.FirstName, last_name = a.Player.LastName },
                events = a.Event == null ? null : new { event_at = a.Event.EventAt }
            })
            .ToListAsync();
        return Ok(rows);
    }
}
