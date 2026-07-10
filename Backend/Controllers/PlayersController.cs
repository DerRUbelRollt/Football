using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamCompass.Api.Data;
using TeamCompass.Api.Services;

namespace TeamCompass.Api.Controllers;

[ApiController]
[Route("players")]
public class PlayersController : ControllerBase
{
    private readonly AppDbContext _ctx;
    public PlayersController(AppDbContext ctx) => _ctx = ctx;

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
