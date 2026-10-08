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

        SyncUpcomingAttendances(ctx);
    }

    // Gleicht die Teilnehmer aller kommenden Ereignisse mit der aktuellen Mannschaftsbelegung ab:
    // fehlende Mitglieder werden als "pending" eingetragen, Nicht-Mitglieder entfernt.
    // Idempotent, vergangene Ereignisse bleiben unverändert.
    private static void SyncUpcomingAttendances(AppDbContext ctx)
    {
        var now = DateTime.UtcNow;

        var missing = (
            from e in ctx.Events
            where e.EventAt >= now
            join m in ctx.PlayerGroupMemberships on e.GroupId equals m.GroupId
            where !ctx.Attendances.Any(a => a.EventId == e.Id && a.PlayerId == m.PlayerId)
            select new { EventId = e.Id, m.PlayerId }
        ).ToList();
        foreach (var row in missing)
        {
            ctx.Attendances.Add(new Attendance { EventId = row.EventId, PlayerId = row.PlayerId, Status = "pending", UpdatedAt = now });
        }

        var orphaned = ctx.Attendances
            .Where(a => a.Event!.EventAt >= now
                && !ctx.PlayerGroupMemberships.Any(m => m.PlayerId == a.PlayerId && m.GroupId == a.Event.GroupId))
            .ToList();
        ctx.Attendances.RemoveRange(orphaned);

        if (missing.Count > 0 || orphaned.Count > 0) ctx.SaveChanges();
    }
}
