<#
Gleicht das EF-Core-Datenmodell aus dem Code (Backend/Data/AppDbContext.cs) mit der
Datenbank ab. Fragt am Start nach Lokal/Produktiv.

Nutzt EF-Core-Migrationen im Hintergrund (reviewbar, versioniert) statt eines blinden
Live-Diffs: der Abgleich passiert immer über generierte, angezeigte SQL, nie durch ein
automatisches DROP/ALTER anhand eines reinen Ist/Soll-Vergleichs. Wendet nichts an, ohne
die geplante SQL vorher vollständig anzuzeigen und explizit mit "ja" bestätigen zu lassen.

Voraussetzung: Backend/Data/Migrations/ existiert bereits (siehe Plan, Teil A).
#>

$ErrorActionPreference = "Stop"

$RepoRoot   = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RepoRoot "Backend"
$Csproj     = "TeamCompass.Api.csproj"

function Read-EnvDockerValue {
    param([string]$Key)
    $envFile = Join-Path $RepoRoot ".env.docker"
    if (-not (Test-Path $envFile)) {
        throw "$envFile nicht gefunden. Datei aus .env.docker.example anlegen und Werte eintragen."
    }
    $line = Get-Content $envFile | Where-Object { $_ -match "^$Key=" } | Select-Object -First 1
    if (-not $line) { throw "$Key nicht in .env.docker gefunden." }
    return ($line -split "=", 2)[1].Trim()
}

function Confirm-Step {
    param([string]$Message)
    return (Read-Host "$Message (ja/nein)").Trim().ToLower() -eq "ja"
}

function Get-MigrationBaselineInfo {
    $listOutput = dotnet ef migrations list --project $Csproj --no-connect
    if ($LASTEXITCODE -ne 0) { throw "dotnet ef migrations list ist fehlgeschlagen." }

    # Nur echte Migrations-IDs (Format <14-stelliger-Zeitstempel>_Name) beruecksichtigen,
    # damit Build-/Warnmeldungen von 'dotnet ef' (z.B. "Build started...") niemals
    # versehentlich als Migrations-ID interpretiert werden.
    $migrationIdLines = $listOutput | Where-Object { $_.Trim() -match "^\d{14}_\w+$" }
    if (-not $migrationIdLines) {
        throw "Konnte keine Migrations-ID aus 'dotnet ef migrations list' ermitteln. Ausgabe war:`n$($listOutput -join "`n")"
    }
    $migrationId = ($migrationIdLines | Where-Object { $_ -match "_InitialCreate$" } | Select-Object -First 1)
    if (-not $migrationId) {
        $migrationId = ($migrationIdLines | Select-Object -First 1)
    }
    $migrationId = $migrationId.Trim()

    $snapshot = Join-Path $BackendDir "Data/Migrations/AppDbContextModelSnapshot.cs"
    $match = Select-String -Path $snapshot -Pattern 'ProductVersion",\s*"([^"]+)"'
    $productVersion = $match.Matches[0].Groups[1].Value

    return [PSCustomObject]@{ Id = $migrationId; Version = $productVersion }
}

function Invoke-LocalBaseline {
    param([string]$Container, [string]$User, [string]$Db)

    $hasHistory = (docker exec -i $Container psql -U $User -d $Db -tAc `
        "SELECT to_regclass('public.\`"__EFMigrationsHistory\`"') IS NOT NULL;").Trim()
    if ($hasHistory -eq "t") {
        return
    }

    $hasTables = (docker exec -i $Container psql -U $User -d $Db -tAc `
        "SELECT to_regclass('public.\`"Trainers\`"') IS NOT NULL;").Trim()
    if ($hasTables -ne "t") {
        # Leere DB - kein Baseline nötig, Migrationen werden gleich normal angewendet.
        return
    }

    Write-Host ""
    Write-Host "DB hat bereits Tabellen (vermutlich per EnsureCreated angelegt), aber keine Migrations-Historie." -ForegroundColor Yellow

    Push-Location $BackendDir
    try {
        $info = Get-MigrationBaselineInfo
    }
    finally {
        Pop-Location
    }

    Write-Host "Würde als bereits angewendet markiert: $($info.Id)"
    Write-Host "(Es wird NUR die Historie-Tabelle geschrieben - kein CREATE/ALTER TABLE läuft dabei.)"
    if (-not (Confirm-Step "Bestätigst du, dass diese DB bereits exakt dem Modellstand von '$($info.Id)' entspricht?")) {
        throw "Abgebrochen. Bitte Schema erst manuell pruefen/angleichen (siehe Plan, Teil A.5), dann Skript erneut starten."
    }

    $sql = @"
CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('$($info.Id)', '$($info.Version)')
ON CONFLICT ("MigrationId") DO NOTHING;
"@
    $sql | docker exec -i $Container psql -U $User -d $Db
    Write-Host "Baseline gesetzt: $($info.Id)" -ForegroundColor Green
}

function Invoke-LocalUpdate {
    Write-Host "=== Lokales Update ===" -ForegroundColor Cyan

    $container = (docker ps --filter "name=postgres" --format "{{.Names}}" | Select-Object -First 1)
    if (-not $container) {
        throw "Kein laufender Postgres-Container gefunden (docker ps --filter name=postgres). Bitte zuerst starten."
    }
    Write-Host "Postgres-Container: $container"

    $pgUser = Read-EnvDockerValue "POSTGRES_USER"
    $pgPass = Read-EnvDockerValue "POSTGRES_PASSWORD"
    $pgDb   = Read-EnvDockerValue "POSTGRES_DB"
    $default = "Host=127.0.0.1;Port=5433;Username=$pgUser;Password=$pgPass;Database=$pgDb"

    $connInput = Read-Host "Connection String [$default]"
    $conn = if ([string]::IsNullOrWhiteSpace($connInput)) { $default } else { $connInput }
    $env:ConnectionStrings__Default = $conn

    Invoke-LocalBaseline -Container $container -User $pgUser -Db $pgDb

    Push-Location $BackendDir
    try {
        Write-Host ""
        Write-Host "Pruefe auf Modell-Aenderungen ohne Migration..."
        dotnet ef migrations has-pending-model-changes --project $Csproj
        $hasPendingChanges = ($LASTEXITCODE -ne 0)

        if ($hasPendingChanges) {
            $name = Read-Host "Neue Modell-Aenderung erkannt. Name fuer die Migration (z.B. AddPlayerNotes)"
            if ([string]::IsNullOrWhiteSpace($name)) { throw "Migrationsname darf nicht leer sein." }
            dotnet ef migrations add $name --project $Csproj --output-dir Data/Migrations
            if ($LASTEXITCODE -ne 0) { throw "dotnet ef migrations add ist fehlgeschlagen." }
        }
        else {
            Write-Host "Keine Modell-Aenderung seit der letzten Migration."
        }

        $scriptPath = Join-Path $env:TEMP "pending-migration-$(Get-Date -Format 'yyyyMMddHHmmss').sql"
        dotnet ef migrations script --idempotent --project $Csproj -o $scriptPath
        if ($LASTEXITCODE -ne 0) { throw "dotnet ef migrations script ist fehlgeschlagen." }

        Write-Host ""
        Write-Host "--- Geplante SQL-Aenderungen ($scriptPath) ---" -ForegroundColor Yellow
        Get-Content $scriptPath | Write-Host
        Write-Host "--- Ende SQL ---" -ForegroundColor Yellow
        Write-Host ""

        if (-not (Confirm-Step "Diese Aenderungen jetzt auf die lokale DB anwenden?")) {
            Write-Host "Abgebrochen. Keine Aenderung vorgenommen." -ForegroundColor Yellow
            return
        }

        dotnet ef database update --project $Csproj
        if ($LASTEXITCODE -ne 0) { throw "dotnet ef database update ist fehlgeschlagen." }

        Write-Host ""
        Write-Host "Fertig. Aktueller Migrationsstand:" -ForegroundColor Green
        dotnet ef migrations list --project $Csproj
    }
    finally {
        Pop-Location
    }
}

function Invoke-ProdUpdate {
    Write-Host "=== Produktiv-Update (via SSH) ===" -ForegroundColor Cyan
    Write-Host "Voraussetzung: Migrationen wurden bereits lokal erstellt/getestet und sind committed + gepusht." -ForegroundColor Yellow
    Write-Host "Voraussetzung: Produktion wurde einmalig gebaselined (siehe Plan, Teil A.5)." -ForegroundColor Yellow
    Write-Host ""

    if (-not (Confirm-Step "Ist der aktuelle Code-Stand (inkl. neuer Migrationen) bereits committed und gepusht?")) {
        Write-Host "Bitte erst committen/pushen, dann erneut starten." -ForegroundColor Yellow
        return
    }

    # Fuer 'migrations script' wird keine echte DB-Verbindung benoetigt (die Produktions-DB
    # ist ohnehin nicht von aussen erreichbar) - die Design-Time-Factory verlangt aber
    # trotzdem eine gesetzte Variable. Ein beliebiger gueltiger Connection-String reicht.
    $pgUser = Read-EnvDockerValue "POSTGRES_USER"
    $pgPass = Read-EnvDockerValue "POSTGRES_PASSWORD"
    $pgDb   = Read-EnvDockerValue "POSTGRES_DB"
    $env:ConnectionStrings__Default = "Host=127.0.0.1;Port=5433;Username=$pgUser;Password=$pgPass;Database=$pgDb"

    $scriptPath = Join-Path $env:TEMP "prod-migration-$(Get-Date -Format 'yyyyMMddHHmmss').sql"
    Push-Location $BackendDir
    try {
        dotnet ef migrations script --idempotent --project $Csproj -o $scriptPath
        if ($LASTEXITCODE -ne 0) { throw "dotnet ef migrations script ist fehlgeschlagen." }
    }
    finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "--- Geplante SQL-Aenderungen fuer PRODUKTIV ---" -ForegroundColor Yellow
    Get-Content $scriptPath | Write-Host
    Write-Host "--- Ende SQL ---" -ForegroundColor Yellow
    Write-Host ""

    if (-not (Confirm-Step "Diese Aenderungen jetzt auf die PRODUKTIONS-Datenbank anwenden?")) {
        Write-Host "Abgebrochen." -ForegroundColor Yellow
        return
    }

    $sshHost   = "strato-vm"
    $remoteDir = "/opt/teamcompass/app"
    $compose   = "docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml"

    Write-Host ""
    Write-Host "git pull auf dem Server..."
    ssh $sshHost "cd $remoteDir && git pull"
    if ($LASTEXITCODE -ne 0) { throw "git pull auf dem Server ist fehlgeschlagen." }

    $backupName = "teamcompass-pre-update-$(Get-Date -Format 'yyyy-MM-dd-HHmm').sql.gz"
    Write-Host "Backup wird erstellt: /var/backups/$backupName"
    ssh $sshHost "cd $remoteDir && $compose exec -T postgres pg_dump -U teamcompass teamcompass | gzip > /var/backups/$backupName"
    if ($LASTEXITCODE -ne 0) { throw "Backup auf dem Server ist fehlgeschlagen." }

    Write-Host "Baue neues Backend-Image (noch ohne Start)..."
    ssh $sshHost "cd $remoteDir && $compose build backend"
    if ($LASTEXITCODE -ne 0) { throw "Backend-Image-Build auf dem Server ist fehlgeschlagen." }

    Write-Host "Wende SQL-Aenderungen auf die Produktions-DB an..."
    Get-Content $scriptPath -Raw | ssh $sshHost "cd $remoteDir && $compose exec -T postgres psql -U teamcompass -d teamcompass"
    if ($LASTEXITCODE -ne 0) { throw "Anwenden der SQL-Aenderungen ist fehlgeschlagen. Backup liegt unter /var/backups/$backupName auf dem Server." }

    Write-Host "Starte neuen Backend-Container..."
    ssh $sshHost "cd $remoteDir && $compose up -d backend"
    if ($LASTEXITCODE -ne 0) { throw "Start des Backend-Containers ist fehlgeschlagen." }

    Write-Host ""
    Write-Host "Migrations-Status auf dem Server:"
    ssh $sshHost "cd $remoteDir && $compose exec -T postgres psql -U teamcompass -d teamcompass -c 'SELECT * FROM \`"__EFMigrationsHistory\`";'"

    Write-Host ""
    Write-Host "Fertig. Backup liegt unter /var/backups/$backupName auf dem Server." -ForegroundColor Green
    Write-Host "Logs pruefen: ssh $sshHost `"cd $remoteDir && $compose logs backend --tail=50`"" -ForegroundColor Green
}

Write-Host "TeamCompass - Datenbank-Update" -ForegroundColor Cyan
Write-Host "Liest das aktuelle EF-Core-Modell aus dem Code und gleicht es mit der DB ab."
Write-Host ""

$mode = (Read-Host "Lokal oder Produktiv? (lokal/produktiv)").Trim().ToLower()
switch ($mode) {
    "lokal"     { Invoke-LocalUpdate }
    "produktiv" { Invoke-ProdUpdate }
    default     { throw "Bitte 'lokal' oder 'produktiv' eingeben." }
}
