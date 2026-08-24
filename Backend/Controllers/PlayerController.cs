using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamCompass.Api.Data;
using TeamCompass.Api.Models;

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
        var upcoming = await _ctx.Events.Include(e => e.Group).Where(e => groupIds.Contains(e.GroupId) && e.EventAt >= now).OrderBy(e => e.EventAt).ToListAsync();
        var history = await _ctx.Events.Include(e => e.Group).Where(e => groupIds.Contains(e.GroupId) && e.EventAt < now).OrderByDescending(e => e.EventAt).Take(50).ToListAsync();

        var upList = upcoming.Select(e => new { id = e.Id, event_type = e.EventType, title = e.Title, opponent = e.Opponent, home_away = e.HomeAway, location = e.Location, meeting_point = e.MeetingPoint, event_at = e.EventAt, description = e.Description, attendances = _ctx.Attendances.Where(a => a.EventId == e.Id && a.PlayerId == player.Id).Select(a => new { id = a.Id, status = a.Status, player_id = a.PlayerId }).ToList() }).ToList();
        var histList = history.Select(e => new { id = e.Id, event_type = e.EventType, title = e.Title, event_at = e.EventAt, attendances = _ctx.Attendances.Where(a => a.EventId == e.Id && a.PlayerId == player.Id).Select(a => new { status = a.Status, player_id = a.PlayerId }).ToList() }).ToList();

        var firstMembership = player.GroupMemberships.OrderBy(m => m.GroupId).FirstOrDefault();
        var p = new { id = player.Id, first_name = player.FirstName, last_name = player.LastName, player_code = player.PlayerCode, group_id = firstMembership?.GroupId ?? 0, player_penalty = player.PlayerPenalty, beer_crates = player.BeerCrates, penalty_manager = player.PenaltyManager, groups = player.GroupMemberships.Select(m => new { name = m.Group!.Name }).ToList() };

        return Ok(new { player = p, upcoming = upList, history = histList });
    }

    [HttpPost("attendance")]
    public async Task<IActionResult> SetAttendance([FromBody] AttendanceRequest req)
    {
        var player = await _ctx.Players.FirstOrDefaultAsync(p => p.PlayerCode == req.Code.ToUpper());
        if (player == null) return NotFound(new { error = "Ungültige Spieler-ID" });

        var ev = await _ctx.Events.FirstOrDefaultAsync(e => e.Id == req.EventId);
        if (ev == null) return NotFound(new { error = "Ereignis nicht gefunden" });

        // Enforce deadline for training events: players may only respond until 16:00 on the event day.
        if (ev.EventType == "training")
        {
            var deadlineUtc = new DateTime(ev.EventAt.Year, ev.EventAt.Month, ev.EventAt.Day, 16, 0, 0, DateTimeKind.Utc);
            if (DateTime.UtcNow >= deadlineUtc)
            {
                return BadRequest(new { error = "Deadline erreicht" });
            }
        }

        var att = await _ctx.Attendances.FirstOrDefaultAsync(a => a.EventId == req.EventId && a.PlayerId == player.Id);
        if (att == null)
        {
            att = new Attendance { EventId = req.EventId, PlayerId = player.Id, Status = req.Status, UpdatedAt = DateTime.UtcNow };
            _ctx.Attendances.Add(att);
        }
        else
        {
            att.Status = req.Status;
            att.UpdatedAt = DateTime.UtcNow;
            _ctx.Attendances.Update(att);
        }
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
        if (!groupIds.Contains(ev.GroupId)) return Unauthorized(new { error = "Nicht deine Mannschaft" });

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
            .Where(a => groupIds.Contains(a.Event!.GroupId) && a.Event!.EventAt < now)
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
            .Where(e => groupIds.Contains(e.GroupId) && e.EventType == "game"
                && e.EventAt <= now.AddHours(1) && e.EventAt > now.AddHours(-3))
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
            .Where(e => groupIds.Contains(e.GroupId) && e.EventType == "game" && e.EventAt <= now.AddHours(-3))
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
public record AttendanceRequest(string Code, int EventId, string Status);
public record PlayerEventResultRequest(string Code, int EventId, int? HomeScore, int? AwayScore);
