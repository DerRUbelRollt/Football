using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamCompass.Api.Data;
using TeamCompass.Api.Services;

namespace TeamCompass.Api.Controllers;

[ApiController]
[Route("attendances")]
public class AttendancesController : ControllerBase
{
    private static readonly string[] AllowedStatuses = { "accepted", "declined", "pending" };

    private readonly AppDbContext _ctx;
    public AttendancesController(AppDbContext ctx) => _ctx = ctx;

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateAttendanceRequest req)
    {
        if (TrainerAuth.FromRequest(Request) is not { } trainer) return Unauthorized(new { error = "Unauthorized" });
        if (!AllowedStatuses.Contains(req.Status)) return BadRequest(new { error = "Ungültiger Status" });

        var att = await _ctx.Attendances.Include(a => a.Event).FirstOrDefaultAsync(a => a.Id == id);
        if (att == null) return NotFound(new { error = "Anwesenheit nicht gefunden" });
        // Bei Events mit Essen gehört zur Zusage die Essenswahl – die trifft nur der Spieler selbst.
        if (att.Event?.WithFood == true) return BadRequest(new { error = "Bei Events mit Essen sagen die Spieler selbst zu oder ab" });

        att.Status = req.Status;
        // Gäste und Essen gibt es nur bei einer Zusage.
        if (req.Status != "accepted") att.ClearAcceptance();
        att.TrainerId = trainer.userId;
        att.UpdatedAt = DateTime.UtcNow;
        await _ctx.SaveChangesAsync();
        return Ok(new { ok = true });
    }
}

public record UpdateAttendanceRequest(string Status);
