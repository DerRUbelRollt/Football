using Microsoft.EntityFrameworkCore;
using TeamCompass.Api.Models;

namespace TeamCompass.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Trainer> Trainers { get; set; } = null!;
    public DbSet<Group> Groups { get; set; } = null!;
    public DbSet<Player> Players { get; set; } = null!;
    public DbSet<Event> Events { get; set; } = null!;
    public DbSet<Attendance> Attendances { get; set; } = null!;
}
