using System.Net;
using System.Net.Sockets;
using Microsoft.EntityFrameworkCore;
using TeamCompass.Api.Data;

var builder = WebApplication.CreateBuilder(args);

var configuredUrls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS");
if (string.IsNullOrWhiteSpace(configuredUrls))
{
    configuredUrls = $"http://localhost:{FindAvailablePort(5001)}";
}
builder.WebHost.UseUrls(configuredUrls);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var conn = builder.Configuration.GetConnectionString("Default") ?? "Host=localhost;Port=5433;Username=postgres;Password=TeamCompass2024;Database=team_compass_dev";
builder.Services.AddDbContext<AppDbContext>(opt => opt.UseNpgsql(conn));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var ctx = services.GetRequiredService<AppDbContext>();
    DbInitializer.Initialize(ctx);
}

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRouting();
app.MapControllers();

app.Run();

static int FindAvailablePort(int preferredPort)
{
    for (var port = preferredPort; port < preferredPort + 20; port++)
    {
        var listener = new TcpListener(IPAddress.Loopback, port);
        try
        {
            listener.Start();
            return ((IPEndPoint)listener.LocalEndpoint).Port;
        }
        catch (SocketException)
        {
            continue;
        }
        finally
        {
            listener.Stop();
        }
    }

    throw new InvalidOperationException("No free port available for the backend.");
}
