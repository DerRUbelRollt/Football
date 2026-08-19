using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace TeamCompass.Api.Data;

// Used only by the `dotnet ef` CLI. Bypasses Program.cs entirely so design-time
// commands never execute DbInitializer.Initialize() as a side effect, and always
// use an explicit connection string, independent of ASPNETCORE_ENVIRONMENT.
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var conn = Environment.GetEnvironmentVariable("ConnectionStrings__Default")
            ?? throw new InvalidOperationException(
                "ConnectionStrings__Default env var muss vor jedem dotnet ef Befehl gesetzt sein.");

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseNpgsql(conn);
        return new AppDbContext(optionsBuilder.Options);
    }
}
