using Microsoft.EntityFrameworkCore;
using TeamCompass.Api.Data;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls("http://localhost:5000");

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var conn = builder.Configuration.GetConnectionString("Default") ?? "Host=localhost;Port=5432;Username=tc_admin;Password=tc_password;Database=team_compass_dev";
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
