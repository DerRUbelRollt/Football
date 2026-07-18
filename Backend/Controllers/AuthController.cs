using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.EntityFrameworkCore;
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
        var name = req.Name.Trim();
        var user = _ctx.Trainers.FirstOrDefault(t => t.Name.ToLower() == name.ToLower());
        if (user == null) return Unauthorized(new { error = "Invalid credentials" });
        var ph = new PasswordHasher<Trainer>();
        var res = ph.VerifyHashedPassword(user, user.PasswordHash, req.Password);
        if (res == PasswordVerificationResult.Failed) return Unauthorized(new { error = "Invalid credentials" });
        var token = SessionStore.CreateSession(user.Id, user.Name);
        SessionCookie.Append(Response, token);
        return Ok(new { user = new { id = user.Id, name = user.Name } });
    }

    [HttpPost("verify")]
    public IActionResult Verify([FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] VerifyRequest? req)
    {
        var token = TrainerAuth.TokenFromRequest(Request) ?? req?.Token;
        var v = token == null ? null : SessionStore.Validate(token);
        if (v == null)
        {
            // Ungültiges/abgelaufenes Cookie direkt beim Client löschen.
            if (Request.Cookies.ContainsKey(SessionCookie.Name)) SessionCookie.Delete(Response);
            return Unauthorized(new { error = "Unauthorized" });
        }
        // Cookie neu ausstellen, damit die Max-Age im Browser mitgleitet.
        SessionCookie.Append(Response, token!);
        return Ok(new { userId = v.Value.userId, name = v.Value.name });
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        var token = TrainerAuth.TokenFromRequest(Request);
        if (!string.IsNullOrEmpty(token)) SessionStore.Remove(token);
        SessionCookie.Delete(Response);
        return Ok(new { ok = true });
    }

    [HttpPatch("me")]
    public IActionResult UpdateMe([FromBody] UpdateMeRequest req)
    {
        if (TrainerAuth.FromRequest(Request) is not { } me) return Unauthorized(new { error = "Unauthorized" });
        var trainer = _ctx.Trainers.FirstOrDefault(t => t.Id == me.userId);
        if (trainer == null) return Unauthorized(new { error = "Unauthorized" });

        var ph = new PasswordHasher<Trainer>();
        if (ph.VerifyHashedPassword(trainer, trainer.PasswordHash, req.CurrentPassword) == PasswordVerificationResult.Failed)
            return BadRequest(new { error = "Aktuelles Passwort ist falsch" });

        if (!string.IsNullOrWhiteSpace(req.NewName))
        {
            var newName = req.NewName.Trim();
            if (newName.Length > 80) return BadRequest(new { error = "Name zu lang" });
            var taken = _ctx.Trainers.Any(t => t.Id != trainer.Id && t.Name.ToLower() == newName.ToLower());
            if (taken) return BadRequest(new { error = "Name bereits vergeben" });
            trainer.Name = newName;
        }

        if (!string.IsNullOrWhiteSpace(req.NewPassword))
        {
            if (req.NewPassword.Length < 8) return BadRequest(new { error = "Passwort muss mindestens 8 Zeichen haben" });
            trainer.PasswordHash = ph.HashPassword(null!, req.NewPassword);
        }

        try
        {
            _ctx.SaveChanges();
        }
        catch (DbUpdateException)
        {
            return BadRequest(new { error = "Name bereits vergeben" });
        }

        return Ok(new { id = trainer.Id, name = trainer.Name });
    }

    [HttpPost("trainers")]
    public IActionResult CreateTrainer([FromBody] CreateTrainerRequest req)
    {
        if (TrainerAuth.FromRequest(Request) is not { } me) return Unauthorized(new { error = "Unauthorized" });
        var caller = _ctx.Trainers.FirstOrDefault(t => t.Id == me.userId);
        if (caller == null) return Unauthorized(new { error = "Unauthorized" });

        var ph = new PasswordHasher<Trainer>();
        if (ph.VerifyHashedPassword(caller, caller.PasswordHash, req.CurrentPassword) == PasswordVerificationResult.Failed)
            return BadRequest(new { error = "Aktuelles Passwort ist falsch" });

        var name = req.Name.Trim();
        if (name.Length == 0 || name.Length > 80) return BadRequest(new { error = "Ungültiger Name" });
        if (req.Password.Length < 8) return BadRequest(new { error = "Passwort muss mindestens 8 Zeichen haben" });
        if (_ctx.Trainers.Any(t => t.Name.ToLower() == name.ToLower())) return BadRequest(new { error = "Name bereits vergeben" });

        var newTrainer = new Trainer { Name = name, PasswordHash = ph.HashPassword(null!, req.Password) };
        _ctx.Trainers.Add(newTrainer);

        try
        {
            _ctx.SaveChanges();
        }
        catch (DbUpdateException)
        {
            return BadRequest(new { error = "Name bereits vergeben" });
        }

        return Ok(new { id = newTrainer.Id, name = newTrainer.Name });
    }
}

public record LoginRequest(string Name, string Password);
public record VerifyRequest(string? Token);
public record UpdateMeRequest(string CurrentPassword, string? NewName, string? NewPassword);
public record CreateTrainerRequest(string Name, string Password, string CurrentPassword);
