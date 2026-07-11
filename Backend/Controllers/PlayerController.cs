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
        return Ok(new { player = new { id = player.Id, first_name = player.FirstName, last_name = player.LastName, player_code = player.PlayerCode, group_id = firstMembership?.GroupId ?? 0, groups = player.GroupMemberships.Select(m => new { name = m.Group!.Name }).ToList() } });
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
        var p = new { id = player.Id, first_name = player.FirstName, last_name = player.LastName, player_code = player.PlayerCode, group_id = firstMembership?.GroupId ?? 0, groups = player.GroupMemberships.Select(m => new { name = m.Group!.Name }).ToList() };

        return Ok(new { player = p, upcoming = upList, history = histList });
    }

    [HttpPost("attendance")]
    public async Task<IActionResult> SetAttendance([FromBody] AttendanceRequest req)
    {
        var player = await _ctx.Players.FirstOrDefaultAsync(p => p.PlayerCode == req.Code.ToUpper());
        if (player == null) return NotFound(new { error = "Ungültige Spieler-ID" });

        var ev = await _ctx.Events.FirstOrDefaultAsync(e => e.Id == req.EventId);
        if (ev == null) return NotFound(new { error = "Ereignis nicht gefunden" });

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
}

public record CodeRequest(string Code);
public record AttendanceRequest(string Code, int EventId, string Status);
