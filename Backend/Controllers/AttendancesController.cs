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

        var att = await _ctx.Attendances.FirstOrDefaultAsync(a => a.Id == id);
        if (att == null) return NotFound(new { error = "Anwesenheit nicht gefunden" });

        att.Status = req.Status;
        att.TrainerId = trainer.userId;
        att.UpdatedAt = DateTime.UtcNow;
        await _ctx.SaveChangesAsync();
        return Ok(new { ok = true });
    }
}

public record UpdateAttendanceRequest(string Status);
