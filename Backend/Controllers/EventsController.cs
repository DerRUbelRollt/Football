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
                e.Id,
                e.EventType,
                e.Title,
                e.Opponent,
                e.HomeAway,
                e.Location,
                e.EventAt,
                GroupName = e.Group == null ? null : e.Group.Name,
                Player = e.Player == null ? null : new { first_name = e.Player.FirstName, last_name = e.Player.LastName },
                e.ProposedTimes,
                // Beim Einzelgespräch steht die Antwort des Spielers in seiner (einzigen) Anwesenheit.
                AttendanceStatus = e.EventType == Event.MeetingType
                    ? _ctx.Attendances.Where(a => a.EventId == e.Id).Select(a => a.Status).FirstOrDefault()
                    : null
            })
            .ToListAsync();
        return Ok(events.Select(e => new
        {
            id = e.Id,
            event_type = e.EventType,
            title = e.Title,
            opponent = e.Opponent,
            home_away = e.HomeAway,
            location = e.Location,
            event_at = e.EventAt,
            groups = e.GroupName == null ? null : new { name = e.GroupName },
            player = e.Player,
            proposed_times = e.ProposedTimes,
            meeting_status = e.EventType == Event.MeetingType ? Event.MeetingStatusOf(e.AttendanceStatus) : null
        }));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] List<CreateEventRequest> rows)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        if (rows.Count == 0) return BadRequest(new { error = "Keine Ereignisse übergeben" });
        if (rows.Count > 60) return BadRequest(new { error = "Zu viele Ereignisse auf einmal" });

        // Einzelgespräche gehören zu einem Spieler statt zu einer Mannschaft.
        if (rows.Any(r => r.EventType != Event.MeetingType && r.GroupId == null)) return BadRequest(new { error = "Mannschaft ist erforderlich" });
        var groupIds = rows.Where(r => r.EventType != Event.MeetingType).Select(r => r.GroupId!.Value).Distinct().ToList();
        var existing = await _ctx.Groups.Where(g => groupIds.Contains(g.Id)).Select(g => g.Id).ToListAsync();
        if (existing.Count != groupIds.Count) return NotFound(new { error = "Mannschaft nicht gefunden" });

        if (rows.Any(r => r.EventType == Event.MeetingType && r.PlayerId == null)) return BadRequest(new { error = "Bitte wähle einen Spieler" });
        var playerIds = rows.Where(r => r.EventType == Event.MeetingType).Select(r => r.PlayerId!.Value).Distinct().ToList();
        var existingPlayers = await _ctx.Players.Where(p => playerIds.Contains(p.Id)).Select(p => p.Id).ToListAsync();
        if (existingPlayers.Count != playerIds.Count) return NotFound(new { error = "Spieler nicht gefunden" });

        var playersByGroup = await _ctx.PlayerGroupMemberships
            .Where(m => groupIds.Contains(m.GroupId))
            .GroupBy(m => m.GroupId)
            .ToDictionaryAsync(g => g.Key, g => g.Select(m => m.PlayerId).ToList());

        var now = DateTime.UtcNow;
        foreach (var row in rows)
        {
            if (string.IsNullOrWhiteSpace(row.Title)) return BadRequest(new { error = "Titel ist erforderlich" });
            if (row.EventType != "training" && row.EventType != "game" && row.EventType != "event" && row.EventType != Event.MeetingType) return BadRequest(new { error = "Ungültiger Ereignistyp" });

            if (row.EventType == Event.MeetingType)
            {
                // Kein festes Datum: der Spieler wählt später einen der Vorschläge.
                var proposals = NormalizeProposals(row.ProposedTimes);
                if (ValidateProposals(proposals, new List<DateTime>(), now) is { } proposalError) return BadRequest(new { error = proposalError });
                var meeting = new Event
                {
                    EventType = Event.MeetingType,
                    Title = row.Title.Trim(),
                    Location = string.IsNullOrWhiteSpace(row.Location) ? null : row.Location.Trim(),
                    Description = string.IsNullOrWhiteSpace(row.Description) ? null : row.Description.Trim(),
                    EventAt = proposals[0],
                    ProposedTimes = proposals,
                    PlayerId = row.PlayerId
                };
                _ctx.Events.Add(meeting);
                _ctx.Attendances.Add(new Attendance { Event = meeting, PlayerId = row.PlayerId!.Value, Status = "pending", UpdatedAt = now });
                continue;
            }

            // Deadline gibt es nur bei Events; sie darf nicht nach dem Beginn liegen.
            var deadline = row.EventType == "event" ? row.DeadlineAt?.ToUniversalTime() : null;
            if (deadline > row.EventAt.ToUniversalTime()) return BadRequest(new { error = DeadlineAfterStartError });

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
                MaxGuests = row.EventType == "event" ? ClampGuests(row.MaxGuests) : 0,
                WithFood = row.EventType == "event" && (row.WithFood ?? false),
                DeadlineAt = deadline,
                GroupId = row.GroupId
            };
            _ctx.Events.Add(ev);

            // Offene Anwesenheiten für alle Spieler der Mannschaft anlegen,
            // damit die Teilnehmerliste des Ereignisses vollständig ist.
            foreach (var playerId in playersByGroup.GetValueOrDefault(row.GroupId!.Value) ?? new List<int>())
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
        var e = await _ctx.Events.Include(ev => ev.Group).Include(ev => ev.Player).FirstOrDefaultAsync(ev => ev.Id == id);
        if (e == null) return NotFound(new { error = "Ereignis nicht gefunden" });
        var meetingStatus = e.EventType == Event.MeetingType
            ? Event.MeetingStatusOf(await _ctx.Attendances.Where(a => a.EventId == id).Select(a => a.Status).FirstOrDefaultAsync())
            : null;
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
            max_guests = e.MaxGuests,
            with_food = e.WithFood,
            deadline_at = e.DeadlineAt,
            group_id = e.GroupId,
            groups = e.Group == null ? null : new { name = e.Group.Name },
            player_id = e.PlayerId,
            player = e.Player == null ? null : new { first_name = e.Player.FirstName, last_name = e.Player.LastName },
            proposed_times = e.ProposedTimes,
            meeting_status = meetingStatus
        });
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateEventRequest req)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var e = await _ctx.Events.FirstOrDefaultAsync(ev => ev.Id == id);
        if (e == null) return NotFound(new { error = "Ereignis nicht gefunden" });
        if (string.IsNullOrWhiteSpace(req.Title)) return BadRequest(new { error = "Titel ist erforderlich" });
        if (e.EventType == Event.MeetingType) return await UpdateMeeting(e, req);
        if (req.GroupId is not int groupId) return BadRequest(new { error = "Mannschaft ist erforderlich" });

        // Der Ereignistyp (Training/Spiel) ist nach dem Erstellen fest.
        var isGame = e.EventType == "game";
        e.Title = req.Title.Trim();
        e.Opponent = isGame && !string.IsNullOrWhiteSpace(req.Opponent) ? req.Opponent.Trim() : null;
        e.HomeAway = isGame && !string.IsNullOrWhiteSpace(req.HomeAway) ? req.HomeAway : null;
        e.Location = string.IsNullOrWhiteSpace(req.Location) ? null : req.Location.Trim();
        e.MeetingPoint = string.IsNullOrWhiteSpace(req.MeetingPoint) ? null : req.MeetingPoint.Trim();
        e.EventAt = req.EventAt.ToUniversalTime();
        e.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();
        // Bereits eingetragene Gäste bleiben beim Senken des Limits erhalten; es greift beim nächsten Speichern.
        // Schon gewählte Essen bleiben gespeichert, falls "Mit Essen" später wieder eingeschaltet wird.
        // Fehlen die Felder in der Anfrage (z. B. aus einer älteren Frontend-Version), bleibt der alte Wert.
        if (e.EventType == "event")
        {
            if (req.MaxGuests is int maxGuests) e.MaxGuests = ClampGuests(maxGuests);
            if (req.WithFood is bool withFood) e.WithFood = withFood;
            // Die Deadline wird immer übernommen – ein leeres Datum im Formular heißt: keine Deadline.
            e.DeadlineAt = req.DeadlineAt?.ToUniversalTime();
            if (e.DeadlineAt > e.EventAt) return BadRequest(new { error = DeadlineAfterStartError });
        }

        if (groupId != e.GroupId)
        {
            if (!await _ctx.Groups.AnyAsync(g => g.Id == groupId)) return NotFound(new { error = "Mannschaft nicht gefunden" });

            // Teilnehmerliste an die neue Mannschaft anpassen: Nicht-Mitglieder entfernen,
            // fehlende Mitglieder offen eintragen. Rückmeldungen von Spielern in beiden Mannschaften bleiben.
            var memberIds = await _ctx.PlayerGroupMemberships
                .Where(m => m.GroupId == groupId)
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
            e.GroupId = groupId;
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
        // Erst laden, dann umformen: Gäste und ihr Essen werden im Speicher zusammengeführt.
        var attendances = await _ctx.Attendances
            .Where(a => a.EventId == id)
            .Include(a => a.Player)
            .OrderBy(a => a.Player!.LastName).ThenBy(a => a.Player!.FirstName)
            .ToListAsync();
        var rows = attendances.Select(a => new
        {
            id = a.Id,
            status = a.Status,
            meal = a.Meal,
            guests = a.GuestEntries(),
            players = a.Player == null ? null : new
            {
                id = a.Player.Id,
                first_name = a.Player.FirstName,
                last_name = a.Player.LastName,
                player_code = a.Player.PlayerCode
            }
        });
        return Ok(rows);
    }

    // Einzelgespräch bearbeiten: Thema, Ort und Beschreibung gehen immer. Spieler und Termine nur,
    // solange der Spieler noch keinen Termin festgelegt hat – danach ist der Termin für beide fest.
    private async Task<IActionResult> UpdateMeeting(Event e, UpdateEventRequest req)
    {
        e.Title = req.Title.Trim();
        e.Location = string.IsNullOrWhiteSpace(req.Location) ? null : req.Location.Trim();
        e.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();

        var attendances = await _ctx.Attendances.Where(a => a.EventId == e.Id).ToListAsync();
        var proposals = req.ProposedTimes == null ? e.ProposedTimes : NormalizeProposals(req.ProposedTimes);
        var playerChanged = req.PlayerId is int newPlayerId && newPlayerId != e.PlayerId;
        var timesChanged = !proposals.SequenceEqual(e.ProposedTimes);

        if (playerChanged || timesChanged)
        {
            if (attendances.Any(a => a.Status == "accepted"))
                return BadRequest(new { error = "Der Termin ist bereits festgelegt – Spieler und Termine lassen sich nicht mehr ändern" });

            var now = DateTime.UtcNow;
            if (timesChanged)
            {
                if (ValidateProposals(proposals, e.ProposedTimes, now) is { } proposalError) return BadRequest(new { error = proposalError });
                e.ProposedTimes = proposals;
                e.EventAt = proposals[0];
            }
            if (playerChanged)
            {
                if (!await _ctx.Players.AnyAsync(p => p.Id == req.PlayerId)) return NotFound(new { error = "Spieler nicht gefunden" });
                e.PlayerId = req.PlayerId;
            }

            // Neue Termine oder ein anderer Spieler: es muss (wieder) gewählt werden – auch nach "Keiner passt".
            var attendance = attendances.FirstOrDefault();
            _ctx.Attendances.RemoveRange(attendances.Skip(1));
            if (attendance == null)
            {
                attendance = new Attendance { EventId = e.Id };
                _ctx.Attendances.Add(attendance);
            }
            attendance.PlayerId = e.PlayerId!.Value;
            attendance.Status = "pending";
            attendance.UpdatedAt = now;
        }

        await _ctx.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // Vorschläge minutengenau in UTC und chronologisch – so ist Vorschlag 1 immer der früheste und
    // die Wahl des Spielers lässt sich exakt mit einem Vorschlag vergleichen.
    private static List<DateTime> NormalizeProposals(List<DateTime>? times) =>
        (times ?? new List<DateTime>()).Select(t => Event.ToMinute(t.ToUniversalTime())).OrderBy(t => t).ToList();

    // Neue Vorschläge müssen in der Zukunft liegen; schon gespeicherte, inzwischen vergangene dürfen bleiben.
    private static string? ValidateProposals(List<DateTime> proposals, List<DateTime> previous, DateTime now)
    {
        if (proposals.Count is < 1 or > 3) return "Bitte 1 bis 3 Terminvorschläge angeben";
        if (proposals.Distinct().Count() != proposals.Count) return "Terminvorschläge dürfen nicht doppelt sein";
        if (proposals.Except(previous).Any(t => t <= now) || proposals.All(t => t <= now)) return "Terminvorschläge müssen in der Zukunft liegen";
        return null;
    }

    private static int ClampGuests(int? maxGuests) => Math.Clamp(maxGuests ?? 0, 0, 20);

    private const string DeadlineAfterStartError = "Die Deadline muss vor dem Beginn des Events liegen";
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
    int? GroupId,
    int? MaxGuests = null,
    bool? WithFood = null,
    DateTime? DeadlineAt = null,
    int? PlayerId = null,
    List<DateTime>? ProposedTimes = null);

public record UpdateEventRequest(
    string Title,
    string? Opponent,
    string? HomeAway,
    string? Location,
    string? MeetingPoint,
    DateTime EventAt,
    string? Description,
    int? GroupId,
    int? MaxGuests = null,
    bool? WithFood = null,
    DateTime? DeadlineAt = null,
    int? PlayerId = null,
    List<DateTime>? ProposedTimes = null);

public record SetResultRequest(int? HomeScore, int? AwayScore);
