using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using TeamCompass.Api.Data;
using TeamCompass.Api.Models;
using TeamCompass.Api.Services;

namespace TeamCompass.Api.Controllers;

[ApiController]
[Route("auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _ctx;
    public AuthController(AppDbContext ctx) => _ctx = ctx;

    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginRequest req)
    {
        var user = _ctx.Trainers.FirstOrDefault(t => t.Email == req.Email);
        if (user == null) return Unauthorized(new { error = "Invalid credentials" });
        var ph = new PasswordHasher<Trainer>();
        var res = ph.VerifyHashedPassword(user, user.PasswordHash, req.Password);
        if (res == PasswordVerificationResult.Failed) return Unauthorized(new { error = "Invalid credentials" });
        var token = SessionStore.CreateSession(user.Id, user.Email);
        return Ok(new
        {
            session = new { access_token = token, refresh_token = token },
            user = new { id = user.Id, email = user.Email }
        });
    }

    [HttpPost("signup")]
    public IActionResult Signup([FromBody] SignupRequest req)
    {
        if (_ctx.Trainers.Any(t => t.Email == req.Email)) return BadRequest(new { error = "Email exists" });
        var ph = new PasswordHasher<Trainer>();
        var t = new Trainer { Email = req.Email, DisplayName = req.DisplayName, PasswordHash = ph.HashPassword(null!, req.Password) };
        _ctx.Trainers.Add(t);
        _ctx.SaveChanges();
        var token = SessionStore.CreateSession(t.Id, t.Email);
        return Ok(new { session = new { access_token = token, refresh_token = token }, user = new { id = t.Id, email = t.Email } });
    }

    [HttpPost("verify")]
    public IActionResult Verify([FromBody] VerifyRequest req)
    {
        var v = SessionStore.Validate(req.Token);
        if (v == null) return Unauthorized(new { error = "Unauthorized" });
        return Ok(new { userId = v.Value.userId, email = v.Value.email });
    }
}

public record LoginRequest(string Email, string Password);
public record SignupRequest(string Email, string Password, string? DisplayName);
public record VerifyRequest(string Token);
