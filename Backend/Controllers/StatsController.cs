using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamCompass.Api.Data;
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
        var upcoming = await _ctx.Events
            .Include(e => e.Group)
            .Where(e => e.EventAt >= now)
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

        var total = await _ctx.Attendances.CountAsync();
        var accepted = await _ctx.Attendances.CountAsync(a => a.Status == "accepted");
        var rate = total > 0 ? (int)Math.Round(accepted * 100.0 / total) : 0;

        return Ok(new { groups, players, upcoming, rate });
    }

    [HttpGet("attendance")]
    public async Task<IActionResult> Attendance()
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });

        var rows = await _ctx.Attendances
            .Include(a => a.Player)
            .Include(a => a.Event)
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
