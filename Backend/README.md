Team Compass .NET Backend

Requirements

- .NET 8 SDK (e.g. 8.0.422)
- PostgreSQL running locally (default connection in appsettings.Development.json)

Default DB credentials (development)

- host: localhost
- port: 5432
- username: tc_admin
- password: tc_password
- database: team_compass_dev

Run locally

```bash
dotnet restore
dotnet run --project Backend/TeamCompass.Api.csproj
```

The app listens on http://localhost:5000 and provides endpoints used by the frontend.
