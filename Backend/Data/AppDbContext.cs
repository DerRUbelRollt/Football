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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
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
    }
}
