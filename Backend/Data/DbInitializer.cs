using Microsoft.AspNetCore.Identity;
using TeamCompass.Api.Models;

namespace TeamCompass.Api.Data;

public static class DbInitializer
{
    public static void Initialize(AppDbContext ctx)
    {
        ctx.Database.EnsureCreated();

        if (!ctx.Trainers.Any())
        {
            var ph = new PasswordHasher<Trainer>();
            var t = new Trainer
            {
                Email = "admin@local",
                DisplayName = "Admin",
                PasswordHash = ph.HashPassword(null!, "adminpass")
            };
            ctx.Trainers.Add(t);
            ctx.SaveChanges();
        }
    }
}
