using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamCompass.Api.Data;
using TeamCompass.Api.Models;
using TeamCompass.Api.Services;

namespace TeamCompass.Api.Controllers;

[ApiController]
[Route("players")]
public class PlayersController : ControllerBase
{
    private readonly AppDbContext _ctx;
    public PlayersController(AppDbContext ctx) => _ctx = ctx;

    [HttpGet]
    public async Task<IActionResult> List()
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var players = await _ctx.Players
            .OrderBy(p => p.LastName).ThenBy(p => p.FirstName)
            .Select(p => new { id = p.Id, first_name = p.FirstName, last_name = p.LastName, player_code = p.PlayerCode })
            .ToListAsync();
        return Ok(players);
    }

    [HttpPost("{id:int}/groups")]
    public async Task<IActionResult> AddGroup(int id, [FromBody] AddPlayerGroupRequest req)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var player = await _ctx.Players.FirstOrDefaultAsync(p => p.Id == id);
        if (player == null) return NotFound(new { error = "Spieler nicht gefunden" });

        var group = await _ctx.Groups.FirstOrDefaultAsync(g => g.Id == req.GroupId);
        if (group == null) return NotFound(new { error = "Mannschaft nicht gefunden" });

        var exists = await _ctx.PlayerGroupMemberships.AnyAsync(m => m.PlayerId == id && m.GroupId == req.GroupId);
        if (exists) return Conflict(new { error = "Spieler ist dieser Mannschaft bereits zugeordnet" });

        _ctx.PlayerGroupMemberships.Add(new PlayerGroupMembership { PlayerId = id, GroupId = req.GroupId });
        await _ctx.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    [HttpDelete("{id:int}/groups/{groupId:int}")]
    public async Task<IActionResult> RemoveGroup(int id, int groupId)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var membership = await _ctx.PlayerGroupMemberships.FirstOrDefaultAsync(m => m.PlayerId == id && m.GroupId == groupId);
        if (membership == null) return NotFound(new { error = "Zuordnung nicht gefunden" });

        var remainingMemberships = await _ctx.PlayerGroupMemberships.CountAsync(m => m.PlayerId == id);
        if (remainingMemberships <= 1)
        {
            var player = await _ctx.Players.FirstOrDefaultAsync(p => p.Id == id);
            if (player != null) _ctx.Players.Remove(player);
        }
        else
        {
            _ctx.PlayerGroupMemberships.Remove(membership);
        }

        await _ctx.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (TrainerAuth.FromRequest(Request) == null) return Unauthorized(new { error = "Unauthorized" });
        var player = await _ctx.Players.FirstOrDefaultAsync(p => p.Id == id);
        if (player == null) return NotFound(new { error = "Spieler nicht gefunden" });
        _ctx.Players.Remove(player);
        await _ctx.SaveChangesAsync();
        return Ok(new { ok = true });
    }
}

public record AddPlayerGroupRequest(int GroupId);
