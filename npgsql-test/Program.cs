using System;
using Npgsql;

var cs = "Host=127.0.0.1;Port=5433;Username=postgres;Password=TeamCompass2024;Database=team_compass_dev;SslMode=Disable;TrustServerCertificate=true;Timeout=15;CommandTimeout=15;Pooling=false";
try
{
    await using var conn = new NpgsqlConnection(cs);
    await conn.OpenAsync();
    Console.WriteLine("CONNECTED");
    await using var cmd = conn.CreateCommand();
    cmd.CommandText = "select current_user";
    var reader = await cmd.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        Console.WriteLine(reader.GetString(0));
    }
}
catch (Exception ex)
{
    Console.WriteLine(ex);
    Environment.Exit(1);
}
