using Microsoft.AspNetCore.Identity;
using TeamCompass.Api.Models;

namespace TeamCompass.Api.Data;

public static class DbInitializer
{
    public static void Initialize(AppDbContext ctx)
    {
        if (!ctx.Trainers.Any())
        {
            var ph = new PasswordHasher<Trainer>();
            var t = new Trainer
            {
                Name = "Trainer",
                PasswordHash = ph.HashPassword(null!, "12345678")
            };
            ctx.Trainers.Add(t);
            ctx.SaveChanges();
        }
    }
}
