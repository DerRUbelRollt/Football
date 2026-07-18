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

```To create the docker DB:
docker run --name tc-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=TeamCompass2024 -p 5433:5432 -d postgres:15
```

Sessions

- Trainer-Login setzt ein HttpOnly-Cookie `tc_session` (SameSite=Lax, 7 Tage gleitende Gültigkeit).
- `POST /auth/logout` beendet die Session und löscht das Cookie.
- Als Fallback (z. B. Swagger) wird weiterhin `Authorization: Bearer <token>` akzeptiert.
- Sessions liegen in-memory: Ein Neustart des Backends meldet alle Trainer ab.

Produktion

- `appsettings.json` enthält nur nicht-geheime Defaults, `appsettings.Production.json` nur produktionsspezifische Overrides (z. B. Logging). Es liegt bewusst kein Connection-String in einer Datei, die eingecheckt wird.
- Erforderliche Umgebungsvariablen beim Deploy setzen:
  - `ASPNETCORE_ENVIRONMENT=Production`
  - `ConnectionStrings__Default=Host=<host>;Port=<port>;Username=<user>;Password=<pass>;Database=<db>`
  - `ASPNETCORE_URLS=http://0.0.0.0:<port>` (bzw. die Adresse, auf der der Reverse-Proxy den Prozess erwartet)
- Fehlt `ConnectionStrings__Default` in einer Nicht-Development-Umgebung, bricht der Start mit einer klaren Fehlermeldung ab, statt still gegen die lokale Dev-Datenbank zu laufen.
- Vor dem produktiven Rollout: `DbInitializer` nutzt aktuell `EnsureCreated()` und legt bei leerer DB automatisch einen Trainer (`Trainer` / `12345678`) an — das ist für Produktion nicht geeignet und sollte vorher durch echte EF-Migrationen ersetzt werden.
