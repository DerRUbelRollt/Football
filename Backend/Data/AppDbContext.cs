using Microsoft.EntityFrameworkCore;
using TeamCompass.Api.Models;

namespace TeamCompass.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Trainer> Trainers { get; set; } = null!;
    public DbSet<Group> Groups { get; set; } = null!;
    public DbSet<Player> Players { get; set; } = null!;
    public DbSet<PlayerGroupMembership> PlayerGroupMemberships { get; set; } = null!;
    public DbSet<Event> Events { get; set; } = null!;
    public DbSet<Attendance> Attendances { get; set; } = null!;
    public DbSet<Preparation> Preparations { get; set; } = null!;
    public DbSet<PreparationWeek> PreparationWeeks { get; set; } = null!;
    public DbSet<PreparationUnit> PreparationUnits { get; set; } = null!;
    public DbSet<PreparationAssignment> PreparationAssignments { get; set; } = null!;
    public DbSet<PreparationEntry> PreparationEntries { get; set; } = null!;
    public DbSet<PreparationEntryImage> PreparationEntryImages { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Trainer>()
            .HasIndex(t => t.Name)
            .IsUnique();

        modelBuilder.Entity<Player>()
            .Property(p => p.PlayerPenalty)
            .HasPrecision(10, 2);

        modelBuilder.Entity<PlayerGroupMembership>()
            .HasIndex(m => new { m.PlayerId, m.GroupId })
            .IsUnique();

        modelBuilder.Entity<PlayerGroupMembership>()
            .HasOne(m => m.Player)
            .WithMany(p => p.GroupMemberships)
            .HasForeignKey(m => m.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PlayerGroupMembership>()
            .HasOne(m => m.Group)
            .WithMany(g => g.PlayerMemberships)
            .HasForeignKey(m => m.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        // Die Mannschaft ist seit den Einzelgesprächen optional – beim Löschen einer Mannschaft
        // sollen ihre Ereignisse trotzdem weiter mitgelöscht werden.
        modelBuilder.Entity<Event>()
            .HasOne(e => e.Group)
            .WithMany()
            .HasForeignKey(e => e.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        // Wird ein Spieler gelöscht, verschwinden auch seine Einzelgespräche.
        modelBuilder.Entity<Event>()
            .HasOne(e => e.Player)
            .WithMany()
            .HasForeignKey(e => e.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);

        // Vorbereitungen: alles hängt per Cascade an der Vorbereitung (bzw. am Spieler), damit beim
        // Löschen einer Mannschaft, Vorbereitung oder eines Spielers auch Einträge und Bilder verschwinden.
        modelBuilder.Entity<Preparation>()
            .HasOne(p => p.Group)
            .WithMany()
            .HasForeignKey(p => p.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PreparationWeek>()
            .HasOne(w => w.Preparation)
            .WithMany(p => p.Weeks)
            .HasForeignKey(w => w.PreparationId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<PreparationWeek>()
            .HasIndex(w => new { w.PreparationId, w.Number })
            .IsUnique();

        modelBuilder.Entity<PreparationUnit>()
            .HasOne(u => u.Week)
            .WithMany(w => w.Units)
            .HasForeignKey(u => u.PreparationWeekId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<PreparationUnit>()
            .HasIndex(u => new { u.PreparationWeekId, u.RunNumber })
            .IsUnique();
        modelBuilder.Entity<PreparationUnit>()
            .Property(u => u.DistanceKm)
            .HasPrecision(5, 2);

        modelBuilder.Entity<PreparationAssignment>()
            .HasOne(a => a.Preparation)
            .WithMany()
            .HasForeignKey(a => a.PreparationId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<PreparationAssignment>()
            .HasOne(a => a.Player)
            .WithMany()
            .HasForeignKey(a => a.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<PreparationAssignment>()
            .HasIndex(a => new { a.PreparationId, a.PlayerId })
            .IsUnique();

        modelBuilder.Entity<PreparationEntry>()
            .HasOne(e => e.Unit)
            .WithMany()
            .HasForeignKey(e => e.PreparationUnitId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<PreparationEntry>()
            .HasOne(e => e.Player)
            .WithMany()
            .HasForeignKey(e => e.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<PreparationEntry>()
            .HasIndex(e => new { e.PreparationUnitId, e.PlayerId })
            .IsUnique();

        modelBuilder.Entity<PreparationEntryImage>()
            .HasKey(i => i.EntryId);
        modelBuilder.Entity<PreparationEntryImage>()
            .HasOne(i => i.Entry)
            .WithOne(e => e.Image)
            .HasForeignKey<PreparationEntryImage>(i => i.EntryId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
