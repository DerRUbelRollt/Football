using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamCompass.Api.Data;
using TeamCompass.Api.Models;
using TeamCompass.Api.Services;

namespace TeamCompass.Api.Controllers;

[ApiController]
[Route("player")]
public class PlayerController : ControllerBase
{
    private readonly AppDbContext _ctx;
    public PlayerController(AppDbContext ctx) => _ctx = ctx;

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] CodeRequest req)
    {
        var player = await _ctx.Players.Include(p => p.GroupMemberships).ThenInclude(m => m.Group).FirstOrDefaultAsync(p => p.PlayerCode == req.Code.ToUpper());
        if (player == null) return NotFound(new { error = "Ungültige Spieler-ID" });
        var firstMembership = player.GroupMemberships.OrderBy(m => m.GroupId).FirstOrDefault();
        return Ok(new
        { player = new {
            id = player.Id,
            first_name = player.FirstName,
            last_name = player.LastName,
            player_code = player.PlayerCode,
            group_id = firstMembership?.GroupId ?? 0,
            player_penalty = player.PlayerPenalty,
            beer_crates = player.BeerCrates,
            penalty_manager = player.PenaltyManager,
            groups = player.GroupMemberships.Select(m => new { name = m.Group!.Name }).ToList() } });
    }

    [HttpPost("overview")]
    public async Task<IActionResult> Overview([FromBody] CodeRequest req)
    {
        var player = await _ctx.Players.Include(p => p.GroupMemberships).ThenInclude(m => m.Group).FirstOrDefaultAsync(p => p.PlayerCode == req.Code.ToUpper());
        if (player == null) return NotFound(new { error = "Ungültige Spieler-ID" });

        var groupIds = player.GroupMemberships.Select(m => m.GroupId).ToList();
        var now = DateTime.UtcNow;
        var upcoming = await _ctx.Events.Include(e => e.Group).Where(e => e.GroupId != null && groupIds.Contains(e.GroupId.Value) && e.EventAt >= now).OrderBy(e => e.EventAt).ToListAsync();
        var history = await _ctx.Events.Include(e => e.Group).Where(e => e.GroupId != null && groupIds.Contains(e.GroupId.Value) && e.EventAt < now).OrderByDescending(e => e.EventAt).Take(50).ToListAsync();

        // Einzelgespräche gehören direkt zum Spieler. Sie stehen oben in einem eigenen Abschnitt, bis
        // 1 Stunde nach dem gewählten Termin (ohne Festlegung: nach dem letzten Vorschlag), danach in der Historie.
        var meetingEvents = await _ctx.Events.Where(e => e.EventType == Event.MeetingType && e.PlayerId == player.Id).OrderBy(e => e.EventAt).ToListAsync();
        var meetingAnswers = await _ctx.Attendances
            .Where(a => a.PlayerId == player.Id && a.Event!.EventType == Event.MeetingType)
            .Select(a => new { a.EventId, a.Status })
            .ToListAsync();
        var meetings = meetingEvents
            .Select(e => new { Event = e, Answer = meetingAnswers.FirstOrDefault(a => a.EventId == e.Id)?.Status ?? "pending" })
            .ToList();
        bool IsActive(Event e, string answer) => now < e.MeetingActiveUntil(answer == "accepted");

        // Vorbereitungs-Ereignisse: aktiv bis Wochenende (Sonntag 23:59), danach in der Historie.
        var prepViews = await PreparationParticipants.ForPlayerAsync(_ctx, player.Id, groupIds, now);
        var prepList = prepViews
            .Where(pv => pv.Units.Any(u => u.EndsAt > now))
            .Select(pv => new
            {
                id = pv.Id,
                title = pv.Title,
                rules = pv.Rules,
                pace_group = pv.PaceGroup,
                units = pv.Units.Where(u => u.EndsAt > now).Select(u => new
                {
                    id = u.Id,
                    week_number = u.WeekNumber,
                    run_number = u.RunNumber,
                    starts_at = u.StartsAt,
                    ends_at = u.EndsAt,
                    distance_km = u.DistanceKm,
                    pace_sec = u.PaceSec,
                    status = u.Status,
                    confirmed = u.Confirmed,
                    trainer_comment = u.TrainerComment,
                    decline_reason = u.DeclineReason,
                    has_image = u.HasImage
                }).ToList()
            })
            .ToList();

        var upList = upcoming.Select(e => new { id = e.Id, event_type = e.EventType, title = e.Title, opponent = e.Opponent, home_away = e.HomeAway, location = e.Location, meeting_point = e.MeetingPoint, event_at = e.EventAt, description = e.Description, max_guests = e.MaxGuests, with_food = e.WithFood, deadline_at = e.DeadlineAt, attendances = _ctx.Attendances.Where(a => a.EventId == e.Id && a.PlayerId == player.Id).ToList().Select(a => new { id = a.Id, status = a.Status, player_id = a.PlayerId, meal = a.Meal, guests = a.GuestEntries() }).ToList() }).ToList();
        var meetList = meetings.Where(m => IsActive(m.Event, m.Answer)).Select(m => new { id = m.Event.Id, event_type = m.Event.EventType, title = m.Event.Title, location = m.Event.Location, description = m.Event.Description, event_at = m.Event.EventAt, proposed_times = m.Event.ProposedTimes, meeting_status = Event.MeetingStatusOf(m.Answer) }).ToList();
        var histList = history.Select(e => new { id = e.Id, event_type = e.EventType, title = e.Title, event_at = e.EventAt, attendances = _ctx.Attendances.Where(a => a.EventId == e.Id && a.PlayerId == player.Id).Select(a => new { status = a.Status, player_id = a.PlayerId }).ToList(), preparation_status = (string?)null })
            .Concat(meetings.Where(m => !IsActive(m.Event, m.Answer)).Select(m => new { id = m.Event.Id, event_type = m.Event.EventType, title = m.Event.Title, event_at = m.Event.EventAt, attendances = new[] { new { status = m.Answer, player_id = player.Id } }.ToList(), preparation_status = (string?)null }))
            .Concat(prepViews.SelectMany(pv => pv.Units.Where(u => u.EndsAt <= now).Select(u => new
            {
                id = u.Id,
                event_type = "preparation",
                title = $"{pv.Title} · Woche {u.WeekNumber} · Training {u.RunNumber}",
                event_at = u.EndsAt,
                attendances = new[] { new { status = PreparationAttendanceStatus(u.Status), player_id = player.Id } }.ToList(),
                preparation_status = (string?)PreparationHistoryStatus(u)
            })))
            .OrderByDescending(h => h.event_at)
            .Take(50)
            .ToList();

        var firstMembership = player.GroupMemberships.OrderBy(m => m.GroupId).FirstOrDefault();
        var p = new { id = player.Id, first_name = player.FirstName, last_name = player.LastName, player_code = player.PlayerCode, group_id = firstMembership?.GroupId ?? 0, player_penalty = player.PlayerPenalty, beer_crates = player.BeerCrates, penalty_manager = player.PenaltyManager, groups = player.GroupMemberships.Select(m => new { name = m.Group!.Name }).ToList() };

        return Ok(new { player = p, upcoming = upList, meetings = meetList, preparations = prepList, history = histList });
    }

    private static string PreparationAttendanceStatus(string status) => status switch
    {
        PreparationEntry.DoneStatus => "accepted",
        PreparationEntry.DeclinedStatus => "declined",
        _ => "pending"
    };

    // Stand eines abgelaufenen Vorbereitungs-Ereignisses in der Historie des Spielers.
    private static string PreparationHistoryStatus(PlayerPreparationUnitView u) => u.Status switch
    {
        PreparationEntry.DoneStatus => u.Confirmed ? "confirmed" : "done",
        PreparationEntry.DeclinedStatus => "declined",
        // Vom Trainer abgelehnt und nicht mehr neu eingereicht.
        _ => u.TrainerComment != null ? "rejected" : "missed"
    };

    // Einzelgespräch: der Spieler legt einen der vorgeschlagenen Termine fest (danach unveränderlich)
    // oder meldet "Keiner passt" – dann wartet er, bis der Trainer neue Termine einträgt.
    [HttpPost("meeting")]
    public async Task<IActionResult> AnswerMeeting([FromBody] MeetingAnswerRequest req)
    {
        var player = await _ctx.Players.FirstOrDefaultAsync(p => p.PlayerCode == req.Code.ToUpper());
        if (player == null) return NotFound(new { error = "Ungültige Spieler-ID" });

        var ev = await _ctx.Events.FirstOrDefaultAsync(e => e.Id == req.EventId && e.EventType == Event.MeetingType);
        if (ev == null) return NotFound(new { error = "Einzelgespräch nicht gefunden" });
        if (ev.PlayerId != player.Id) return Unauthorized(new { error = "Nicht dein Einzelgespräch" });

        var att = await _ctx.Attendances.FirstOrDefaultAsync(a => a.EventId == ev.Id && a.PlayerId == player.Id);
        if (att == null)
        {
            att = new Attendance { EventId = ev.Id, PlayerId = player.Id };
            _ctx.Attendances.Add(att);
        }
        if (att.Status == "accepted") return Conflict(new { error = "Der Termin ist bereits festgelegt" });
        if (att.Status == "declined") return BadRequest(new { error = "Du hast „Keiner passt“ gemeldet – warte auf neue Termine vom Trainer" });

        var now = DateTime.UtcNow;
        if (req.NoneFits)
        {
            att.Status = "declined";
        }
        else
        {
            if (req.ChosenAt is not DateTime chosenAt) return BadRequest(new { error = "Bitte wähle einen Termin" });
            var chosen = Event.ToMinute(chosenAt.ToUniversalTime());
            if (!ev.ProposedTimes.Contains(chosen)) return BadRequest(new { error = "Dieser Termin wurde nicht (mehr) vorgeschlagen – bitte neu laden" });
            if (chosen <= now) return BadRequest(new { error = "Dieser Termin liegt in der Vergangenheit" });
            att.Status = "accepted";
            ev.EventAt = chosen;
        }
        att.UpdatedAt = now;
        await _ctx.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    [HttpPost("attendance")]
    public async Task<IActionResult> SetAttendance([FromBody] AttendanceRequest req)
    {
        var player = await _ctx.Players.FirstOrDefaultAsync(p => p.PlayerCode == req.Code.ToUpper());
        if (player == null) return NotFound(new { error = "Ungültige Spieler-ID" });

        var ev = await _ctx.Events.FirstOrDefaultAsync(e => e.Id == req.EventId);
        if (ev == null) return NotFound(new { error = "Ereignis nicht gefunden" });
        // Beim Einzelgespräch gibt es kein Zu-/Absagen, sondern die Terminwahl (player/meeting).
        if (ev.EventType == Event.MeetingType) return BadRequest(new { error = "Bitte wähle einen Termin" });
        // Nur für Ereignisse der eigenen Mannschaft(en) zu- oder absagen.
        if (!await _ctx.PlayerGroupMemberships.AnyAsync(m => m.PlayerId == player.Id && m.GroupId == ev.GroupId))
            return Unauthorized(new { error = "Nicht deine Mannschaft" });

        // Enforce deadline for training events: players may only respond until 13:00 on the event day.
        if (ev.EventType == "training")
        {
            var deadlineUtc = new DateTime(ev.EventAt.Year, ev.EventAt.Month, ev.EventAt.Day, 13, 0, 0, DateTimeKind.Utc);
            if (DateTime.UtcNow >= deadlineUtc)
            {
                return BadRequest(new { error = "Deadline erreicht" });
            }
        }
        // Events können eine eigene Deadline haben; danach sind Zu-/Absage, Gäste und Essen fest.
        if (ev.EventType == "event" && ev.DeadlineAt is { } eventDeadline && DateTime.UtcNow >= eventDeadline)
        {
            return BadRequest(new { error = "Deadline erreicht" });
        }

        // Gäste und Essen nur bei Zusage zu einem Event; bei Absage/offen oder anderen Typen werden sie entfernt.
        var guests = new List<GuestInput>();
        if (ev.EventType == "event" && req.Status == "accepted")
        {
            guests = (req.Guests ?? new List<GuestInput>())
                .Select(g => g with { Name = (g.Name ?? "").Trim() })
                .Where(g => g.Name.Length > 0)
                .Select(g => g.Name.Length > 80 ? g with { Name = g.Name[..80] } : g)
                .ToList();
            if (guests.Count > ev.MaxGuests)
            {
                return BadRequest(new { error = ev.MaxGuests == 0 ? "Bei diesem Event sind keine Gäste erlaubt" : $"Maximal {ev.MaxGuests} Gäste erlaubt" });
            }
            if (ev.WithFood)
            {
                if (!Attendance.Meals.Contains(req.Meal)) return BadRequest(new { error = "Bitte wähle dein Essen" });
                var missing = guests.FirstOrDefault(g => !Attendance.Meals.Contains(g.Meal));
                if (missing != null) return BadRequest(new { error = $"Bitte wähle ein Essen für {missing.Name}" });
            }
        }

        var att = await _ctx.Attendances.FirstOrDefaultAsync(a => a.EventId == req.EventId && a.PlayerId == player.Id);
        if (att == null)
        {
            att = new Attendance { EventId = req.EventId, PlayerId = player.Id, UpdatedAt = DateTime.UtcNow };
            _ctx.Attendances.Add(att);
        }
        var withMeals = ev.EventType == "event" && ev.WithFood && req.Status == "accepted";
        att.Status = req.Status;
        att.Guests = guests.Select(g => g.Name).ToList();
        att.Meal = withMeals ? req.Meal : null;
        att.GuestMeals = withMeals ? guests.Select(g => g.Meal!).ToList() : new();
        att.UpdatedAt = DateTime.UtcNow;
        await _ctx.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    [HttpPatch("penalty")]
    public async Task<IActionResult> UpdatePenalty([FromBody] PlayerPenaltyRequest req)
    {
        var manager = await _ctx.Players.FirstOrDefaultAsync(p => p.PlayerCode == req.ManagerCode.ToUpper());
        if (manager == null || !manager.PenaltyManager)
            return Unauthorized(new { error = "Nicht berechtigt" });

        var player = await _ctx.Players
            .FirstOrDefaultAsync(p => p.PlayerCode == req.Code.ToUpper());

        if (player == null)
            return NotFound(new { error = "Ungültige Spieler-ID" });

        player.PlayerPenalty = Math.Max(0, player.PlayerPenalty + req.Amount);
        player.BeerCrates = Math.Max(0, player.BeerCrates + req.CrateAmount);

        await _ctx.SaveChangesAsync();

        return Ok(new
        {
            ok = true,
            player_id = player.Id,
            player_penalty = player.PlayerPenalty,
            beer_crates = player.BeerCrates
        });
    }

    [HttpPatch("event-result")]
    public async Task<IActionResult> SetEventResult([FromBody] PlayerEventResultRequest req)
    {
        var player = await _ctx.Players.Include(p => p.GroupMemberships)
            .FirstOrDefaultAsync(p => p.PlayerCode == req.Code.ToUpper());
        if (player == null) return NotFound(new { error = "Ungültige Spieler-ID" });

        var ev = await _ctx.Events.FirstOrDefaultAsync(e => e.Id == req.EventId);
        if (ev == null) return NotFound(new { error = "Ereignis nicht gefunden" });
        if (ev.EventType != "game") return BadRequest(new { error = "Ergebnis nur bei Spielen möglich" });

        var groupIds = player.GroupMemberships.Select(m => m.GroupId).ToList();
        if (ev.GroupId is not int eventGroupId || !groupIds.Contains(eventGroupId)) return Unauthorized(new { error = "Nicht deine Mannschaft" });

        ev.HomeScore = req.HomeScore;
        ev.AwayScore = req.AwayScore;
        await _ctx.SaveChangesAsync();
        return Ok(new { ok = true, home_score = ev.HomeScore, away_score = ev.AwayScore });
    }

    [HttpPost("team")]
    public async Task<IActionResult> Team([FromBody] CodeRequest req)
    {
        var player = await _ctx.Players.Include(p => p.GroupMemberships)
            .FirstOrDefaultAsync(p => p.PlayerCode == req.Code.ToUpper());
        if (player == null) return NotFound(new { error = "Ungültige Spieler-ID" });

        var groupIds = player.GroupMemberships.Select(m => m.GroupId).ToList();
        var now = DateTime.UtcNow;

        var attendanceRaw = await _ctx.Attendances
            // Nur Trainings zaehlen - die Anwesenheits-Uebersicht der Mannschaft soll sich
            // ausschliesslich auf Trainingsbeteiligung beziehen, nicht auf Spiele.
            .Where(a => a.Event!.GroupId != null && groupIds.Contains(a.Event.GroupId.Value) && a.Event!.EventAt < now && a.Event!.EventType == "training")
            .GroupBy(a => new { a.PlayerId, First = a.Player!.FirstName, Last = a.Player.LastName })
            .Select(g => new
            {
                player_id = g.Key.PlayerId,
                first_name = g.Key.First,
                last_name = g.Key.Last,
                total = g.Count(),
                accepted = g.Count(a => a.Status == "accepted"),
                declined = g.Count(a => a.Status == "declined"),
                pending = g.Count(a => a.Status == "pending"),
            })
            .ToListAsync();

        var attendanceTable = attendanceRaw
            .Select(r => new
            {
                r.player_id,
                r.first_name,
                r.last_name,
                r.total,
                r.accepted,
                r.declined,
                r.pending,
                quote = r.total > 0 ? (int)Math.Round(r.accepted * 100.0 / r.total) : 0
            })
            .OrderByDescending(r => r.quote)
            .ThenBy(r => r.last_name).ThenBy(r => r.first_name)
            .ToList();

        // Ein Spiel gilt als "aktuell" (laufend/kurz bevorstehend) ab 1 Stunde vor Anpfiff bis 3 Stunden
        // danach (grosszuegiger Puffer fuer Spieldauer + Nachbereitung), damit dort schon vorab/live ein
        // Ergebnis eingetragen werden kann. Ausserhalb dieses Fensters zaehlt ein Spiel als "vergangen".
        var currentGame = await _ctx.Events
            .Where(e => e.GroupId != null && groupIds.Contains(e.GroupId.Value) && e.EventType == "game"
                && e.EventAt <= now.AddHours(-1.25) && e.EventAt > now.AddHours(-3.25))
            .OrderBy(e => e.EventAt)
            .Select(e => new
            {
                id = e.Id,
                title = e.Title,
                opponent = e.Opponent,
                home_away = e.HomeAway,
                event_at = e.EventAt,
                home_score = e.HomeScore,
                away_score = e.AwayScore
            })
            .FirstOrDefaultAsync();

        // Fuer die Mannschaft-Ansicht reichen die letzten 5 vergangenen Spiele (Formkurve + Liste).
        var pastGames = await _ctx.Events
            .Where(e => e.GroupId != null && groupIds.Contains(e.GroupId.Value) && e.EventType == "game" && e.EventAt <= now.AddHours(-3))
            .OrderByDescending(e => e.EventAt)
            .Take(5)
            .Select(e => new
            {
                id = e.Id,
                title = e.Title,
                opponent = e.Opponent,
                home_away = e.HomeAway,
                event_at = e.EventAt,
                home_score = e.HomeScore,
                away_score = e.AwayScore
            })
            .ToListAsync();

        var penalties = await _ctx.Players
            .OrderByDescending(p => p.PlayerPenalty)
            .ThenBy(p => p.LastName).ThenBy(p => p.FirstName)
            .Select(p => new { id = p.Id, first_name = p.FirstName, last_name = p.LastName, player_penalty = p.PlayerPenalty, beer_crates = p.BeerCrates })
            .ToListAsync();

        return Ok(new { attendanceTable, currentGame, pastGames, penalties });
    }

    [HttpPost("penalties")]
    public async Task<IActionResult> ListPenalties([FromBody] ManagerCodeRequest req)
    {
        var manager = await _ctx.Players.FirstOrDefaultAsync(p => p.PlayerCode == req.ManagerCode.ToUpper());
        if (manager == null || !manager.PenaltyManager)
            return Unauthorized(new { error = "Nicht berechtigt" });

        var players = await _ctx.Players
            .OrderByDescending(p => p.PlayerPenalty)
            .ThenBy(p => p.LastName).ThenBy(p => p.FirstName)
            .Select(p => new { id = p.Id, first_name = p.FirstName, last_name = p.LastName, player_code = p.PlayerCode, player_penalty = p.PlayerPenalty, beer_crates = p.BeerCrates })
            .ToListAsync();

        return Ok(players);
    }
}

public record PlayerPenaltyRequest(string ManagerCode, string Code, decimal Amount, int CrateAmount = 0);
public record ManagerCodeRequest(string ManagerCode);
public record CodeRequest(string Code);
public record AttendanceRequest(string Code, int EventId, string Status, string? Meal = null, List<GuestInput>? Guests = null);
public record GuestInput(string Name, string? Meal);
public record MeetingAnswerRequest(string Code, int EventId, DateTime? ChosenAt = null, bool NoneFits = false);
public record PlayerEventResultRequest(string Code, int EventId, int? HomeScore, int? AwayScore);
