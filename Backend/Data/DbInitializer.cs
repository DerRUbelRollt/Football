using Microsoft.AspNetCore.Identity;
using Npgsql;
using TeamCompass.Api.Models;

namespace TeamCompass.Api.Data;

public static class DbInitializer
{
    public static void Initialize(AppDbContext ctx)
    {
        bool hasTrainers;
        try
        {
            hasTrainers = ctx.Trainers.Any();
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UndefinedTable)
        {
            throw new InvalidOperationException(
                "Datenbankschema ist noch nicht initialisiert (Tabelle \"Trainers\" fehlt). " +
                "Bitte zuerst scripts/Update-Database.ps1 ausfuehren, dann die App erneut starten.",
                ex);
        }

        if (!hasTrainers)
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
