using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamCompass.Api.Data;
using TeamCompass.Api.Models;
using TeamCompass.Api.Services;

namespace TeamCompass.Api.Controllers;

[ApiController]
[Route("groups")]
public class GroupsController : ControllerBase
{
    private readonly AppDbContext _ctx;
    public GroupsController(AppDbContext ctx) => _ctx = ctx;

    [HttpGet]
    public async Task<IActionResult> List()
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var groups = await _ctx.Groups
            .OrderByDescending(g => g.Id)
            .Select(g => new
            {
                id = g.Id,
                name = g.Name,
                description = g.Description,
                player_count = _ctx.PlayerGroupMemberships.Count(m => m.GroupId == g.Id)
            })
            .ToListAsync();
        return Ok(groups);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateGroupRequest req)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { error = "Name ist erforderlich" });

        var group = new Group { Name = req.Name.Trim(), Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim() };
        _ctx.Groups.Add(group);
        await _ctx.SaveChangesAsync();
        return Ok(new { id = group.Id, name = group.Name, description = group.Description });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var group = await _ctx.Groups.FirstOrDefaultAsync(g => g.Id == id);
        if (group == null) return NotFound(new { error = "Mannschaft nicht gefunden" });
        return Ok(new { id = group.Id, name = group.Name, description = group.Description });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var group = await _ctx.Groups.FirstOrDefaultAsync(g => g.Id == id);
        if (group == null) return NotFound(new { error = "Mannschaft nicht gefunden" });
        _ctx.Groups.Remove(group);
        await _ctx.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    [HttpGet("{id:int}/players")]
    public async Task<IActionResult> Players(int id)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var players = await _ctx.PlayerGroupMemberships
            .Where(m => m.GroupId == id)
            .Select(m => m.Player)
            .Where(p => p != null)
            .OrderBy(p => p!.LastName).ThenBy(p => p.FirstName)
            .Select(p => new { id = p.Id, first_name = p.FirstName, last_name = p.LastName, player_code = p.PlayerCode, group_id = id })
            .ToListAsync();
        return Ok(players);
    }

    [HttpPost("{id:int}/players")]
    public async Task<IActionResult> AddPlayer(int id, [FromBody] CreatePlayerRequest req)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        if (string.IsNullOrWhiteSpace(req.FirstName) || string.IsNullOrWhiteSpace(req.LastName))
            return BadRequest(new { error = "Vor- und Nachname sind erforderlich" });

        var group = await _ctx.Groups.FirstOrDefaultAsync(g => g.Id == id);
        if (group == null) return NotFound(new { error = "Mannschaft nicht gefunden" });

        // Nur der Nachname wird verglichen, da für Vornamen oft Spitznamen verwendet werden.
        var lastName = req.LastName.Trim();
        if (!req.Force)
        {
            var duplicates = await _ctx.Players
                .Where(p => p.LastName.ToLower() == lastName.ToLower())
                .Select(p => new { id = p.Id, first_name = p.FirstName, last_name = p.LastName, player_code = p.PlayerCode })
                .ToListAsync();
            if (duplicates.Count > 0)
                return Conflict(new { error = "Ein Spieler mit diesem Nachnamen existiert bereits", duplicates });
        }

        string? code = null;
        for (var i = 0; i < 5; i++)
        {
            var candidate = GeneratePlayerCode();
            if (!await _ctx.Players.AnyAsync(p => p.PlayerCode == candidate)) { code = candidate; break; }
        }
        if (code == null) return Conflict(new { error = "Konnte keine eindeutige Spieler-ID generieren" });

        var player = new Player { FirstName = req.FirstName.Trim(), LastName = req.LastName.Trim(), PlayerCode = code };
        _ctx.Players.Add(player);
        _ctx.PlayerGroupMemberships.Add(new PlayerGroupMembership { Player = player, GroupId = id });

        // Für kommende Ereignisse der Mannschaft direkt offene Anwesenheiten anlegen,
        // damit der Spieler in den Teilnehmerlisten auftaucht.
        var now = DateTime.UtcNow;
        var upcomingEvents = await _ctx.Events.Where(e => e.GroupId == id && e.EventAt >= now).ToListAsync();
        foreach (var ev in upcomingEvents)
        {
            _ctx.Attendances.Add(new Attendance { EventId = ev.Id, Player = player, Status = "pending", UpdatedAt = now });
        }

        await _ctx.SaveChangesAsync();
        return Ok(new { id = player.Id, first_name = player.FirstName, last_name = player.LastName, player_code = player.PlayerCode, group_id = id });
    }

    private static string GeneratePlayerCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        return new string(Enumerable.Range(0, 8).Select(_ => chars[Random.Shared.Next(chars.Length)]).ToArray());
    }
}

public record CreateGroupRequest(string Name, string? Description);
public record CreatePlayerRequest(string FirstName, string LastName, bool Force = false);
