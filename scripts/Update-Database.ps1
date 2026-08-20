<#
Gleicht das EF-Core-Datenmodell aus dem Code (Backend/Data/AppDbContext.cs) mit der
Datenbank ab. Fragt am Start nach Lokal/Produktiv.

Nutzt EF-Core-Migrationen im Hintergrund (reviewbar, versioniert) statt eines blinden
Live-Diffs: der Abgleich passiert immer über generierte, angezeigte SQL, nie durch ein
automatisches DROP/ALTER anhand eines reinen Ist/Soll-Vergleichs. Wendet nichts an, ohne
die geplante SQL vorher vollständig anzuzeigen und explizit mit "ja" bestätigen zu lassen.

Im Produktiv-Pfad baut und startet das Skript zusätzlich Backend- und Frontend-Container neu
(nicht nur die DB) - nach "git push" + "git pull" auf dem Server reicht damit ein einziger
Lauf dieses Skripts, um die VM komplett auf den neuen Stand zu bringen.

Voraussetzung: Backend/Data/Migrations/ existiert bereits (siehe Plan, Teil A).
#>

$ErrorActionPreference = "Stop"
# Default-Konsolenencoding ist US-ASCII - ohne das hier wuerden Umlaute in einer
# generierten Migration (z.B. deutsche Spalten-/Tabellenkommentare) beim Anzeigen/Weiterreichen
# der SQL im Skript zu "?" korrumpiert, inkl. auf dem Produktions-Weg.
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$RepoRoot   = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RepoRoot "Backend"
$Csproj     = "TeamCompass.Api.csproj"

function Read-EnvDockerValue {
    param([string]$Key)
    $envFile = Join-Path $RepoRoot ".env.docker"
    if (-not (Test-Path $envFile)) {
        throw "$envFile nicht gefunden. Datei aus .env.docker.example anlegen und Werte eintragen."
    }
    $pattern = "^" + [regex]::Escape($Key) + "="
    $line = Get-Content $envFile | Where-Object { $_ -match $pattern } | Select-Object -First 1
    if (-not $line) { throw "$Key nicht in .env.docker gefunden." }
    $value = ($line -split "=", 2)[1]
    # Inline-Kommentare (" # ...") abschneiden, wie docker compose es beim Einlesen tut,
    # und umschliessende Anfuehrungszeichen entfernen - sonst landet z.B. ein Kommentar
    # oder ein Anfuehrungszeichen als Teil des Passworts im Connection String.
    $value = $value -replace '\s+#.*$', ''
    $value = $value.Trim()
    $value = $value.Trim('"').Trim("'")
    return $value
}

function Confirm-Step {
    param([string]$Message)
    return (Read-Host "$Message (ja/nein)").Trim().ToLower() -eq "ja"
}

function Format-ConnStringValue {
    # Npgsql-Connection-String-Werte mit ';' oder eingebetteten Anfuehrungszeichen muessen
    # in einfache Anfuehrungszeichen gefasst werden, sonst zerreisst ein Zeichen wie ';'
    # im Passwort den Connection String an der falschen Stelle.
    param([string]$Value)
    return "'" + ($Value -replace "'", "''") + "'"
}

function New-LocalConnectionString {
    param([string]$User, [string]$Pass, [string]$Db)
    return "Host=127.0.0.1;Port=5433;Username=$(Format-ConnStringValue $User);Password=$(Format-ConnStringValue $Pass);Database=$(Format-ConnStringValue $Db)"
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
    if (-not $match -or $match.Matches.Count -eq 0) {
        throw "Konnte ProductVersion nicht aus $snapshot ermitteln."
    }
    $productVersion = $match.Matches[0].Groups[1].Value

    return [PSCustomObject]@{ Id = $migrationId; Version = $productVersion }
}

function Invoke-LocalBaseline {
    param([string]$Container, [string]$User, [string]$Db)

    $hasHistoryRaw = docker exec -i $Container psql -U $User -d $Db -tAc `
        "SELECT to_regclass('public.\`"__EFMigrationsHistory\`"') IS NOT NULL;"
    if ($LASTEXITCODE -ne 0) { throw "Konnte DB-Status nicht pruefen (docker exec/psql fehlgeschlagen)." }
    $hasHistory = ($hasHistoryRaw | Out-String).Trim()
    if ($hasHistory -eq "t") {
        return
    }

    $hasTablesRaw = docker exec -i $Container psql -U $User -d $Db -tAc `
        "SELECT to_regclass('public.\`"Trainers\`"') IS NOT NULL;"
    if ($LASTEXITCODE -ne 0) { throw "Konnte DB-Status nicht pruefen (docker exec/psql fehlgeschlagen)." }
    $hasTables = ($hasTablesRaw | Out-String).Trim()
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
    $sql | docker exec -i $Container psql -v ON_ERROR_STOP=1 -U $User -d $Db
    if ($LASTEXITCODE -ne 0) { throw "Baseline-SQL ist fehlgeschlagen - __EFMigrationsHistory wurde NICHT geschrieben." }
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
    $conn   = New-LocalConnectionString -User $pgUser -Pass $pgPass -Db $pgDb

    # Bewusst kein frei eingebbarer Connection String: die Baseline-Pruefung laeuft ueber
    # "docker exec" gegen $container/$pgDb, "dotnet ef" gegen $conn - ein frei getippter,
    # abweichender Connection String wuerde beide Ziele auseinanderlaufen lassen.
    Write-Host "Ziel-Datenbank: $pgDb auf $container (Host=127.0.0.1;Port=5433;Username=$pgUser)"
    if (-not (Confirm-Step "Passt das (Container + .env.docker-Zugangsdaten)?")) {
        throw "Abgebrochen. Falls das nicht passt: .env.docker korrigieren oder den richtigen Postgres-Container starten, dann erneut versuchen."
    }
    $env:ConnectionStrings__Default = $conn

    try {
        Invoke-LocalBaseline -Container $container -User $pgUser -Db $pgDb

        Push-Location $BackendDir
        try {
            Write-Host ""
            Write-Host "Pruefe auf Modell-Aenderungen ohne Migration..."
            $pendingOutput = dotnet ef migrations has-pending-model-changes --project $Csproj 2>&1
            $pendingOutput | Write-Host
            $pendingText = ($pendingOutput | Out-String)

            # Reihenfolge wichtig: "No changes have been made..." enthaelt als Teilstring
            # auch "changes have been made...", und -match ist standardmaessig case-insensitiv -
            # die spezifischere "No changes"-Meldung muss deshalb zuerst geprueft werden, sonst
            # gewinnt faelschlich immer der "Aenderung erkannt"-Zweig.
            if ($pendingText -match "No changes have been made to the model") {
                $hasPendingChanges = $false
            }
            elseif ($pendingText -match "Changes have been made to the model") {
                $hasPendingChanges = $true
            }
            else {
                throw "dotnet ef migrations has-pending-model-changes lieferte eine unerwartete Ausgabe (Build-/EF-Fehler?) - siehe Ausgabe oben. Abbruch statt Raten."
            }

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
    finally {
        Remove-Item Env:\ConnectionStrings__Default -ErrorAction SilentlyContinue
    }
}

function Invoke-ProdUpdate {
    Write-Host "=== Produktiv-Update (via SSH) ===" -ForegroundColor Cyan
    Write-Host "Baut/startet neben der DB-Migration auch Backend- und Frontend-Container neu." -ForegroundColor Yellow
    Write-Host "Voraussetzung: Migrationen wurden bereits lokal erstellt/getestet und sind committed + gepusht." -ForegroundColor Yellow
    Write-Host "Voraussetzung: Produktion wurde einmalig gebaselined (siehe Plan, Teil A.5)." -ForegroundColor Yellow
    Write-Host ""

    if (-not (Confirm-Step "Ist der aktuelle Code-Stand (inkl. neuer Migrationen) bereits committed und gepusht?")) {
        Write-Host "Bitte erst committen/pushen, dann erneut starten." -ForegroundColor Yellow
        return
    }

    # Fuer 'migrations script' wird keine echte DB-Verbindung benoetigt (die Produktions-DB
    # ist ohnehin nicht von aussen erreichbar, und der Befehl verbindet sich dafuer auch
    # nicht) - die Design-Time-Factory verlangt aber trotzdem eine gesetzte Variable.
    # Bewusst ein erfundener Platzhalter statt echter Zugangsdaten, die hier nicht gebraucht
    # werden und nichts in der Prozessumgebung/im Speicher verloren haben.
    $env:ConnectionStrings__Default = "Host=127.0.0.1;Port=1;Username=platzhalter;Password=platzhalter;Database=platzhalter"

    $scriptPath = Join-Path $env:TEMP "prod-migration-$(Get-Date -Format 'yyyyMMddHHmmss').sql"
    try {
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

        # Backup zuerst, noch vor "git pull" - haengt inhaltlich nicht vom Code-Stand ab,
        # und so ist bei jedem Abbruch vor diesem Punkt garantiert nichts an DB oder Server
        # veraendert.
        # /var/backups/ gehoert root, "max" hat dort ohne Passwort-Sudo keine Schreibrechte
        # (live getestet) - deshalb ~/backups/ auf dem Server, analog zum manuellen Vorgehen.
        Write-Host ""
        $backupName = "teamcompass-pre-update-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').sql.gz"
        Write-Host "Backup wird erstellt: ~/backups/$backupName"
        ssh $sshHost "set -o pipefail; mkdir -p ~/backups && cd $remoteDir && $compose exec -T postgres pg_dump -U teamcompass teamcompass | gzip > ~/backups/$backupName"
        if ($LASTEXITCODE -ne 0) { throw "Backup auf dem Server ist fehlgeschlagen (pg_dump/gzip). Es wurde noch NICHTS an Code oder DB veraendert." }

        ssh $sshHost "test -s ~/backups/$backupName && gzip -t ~/backups/$backupName"
        if ($LASTEXITCODE -ne 0) { throw "Backup-Datei ~/backups/$backupName ist leer oder beschaedigt - Abbruch vor jeder DB-Aenderung. Es wurde noch NICHTS an Code oder DB veraendert. Manuell pruefen: ssh $sshHost 'ls -la ~/backups/'" }
        Write-Host "Backup geprueft (vorhanden, nicht leer, gueltiges gzip)." -ForegroundColor Green

        Write-Host "git pull auf dem Server..."
        ssh $sshHost "cd $remoteDir && git pull"
        if ($LASTEXITCODE -ne 0) { throw "git pull auf dem Server ist fehlgeschlagen. Backup liegt bereits unter ~/backups/$backupName, DB wurde noch NICHT veraendert." }

        Write-Host "Baue neue Backend- und Frontend-Images (noch ohne Start)..."
        ssh $sshHost "cd $remoteDir && $compose build backend frontend"
        if ($LASTEXITCODE -ne 0) { throw "Image-Build (Backend/Frontend) auf dem Server ist fehlgeschlagen. Backup liegt unter ~/backups/$backupName, DB wurde noch NICHT veraendert." }

        Write-Host "Wende SQL-Aenderungen auf die Produktions-DB an..."
        Get-Content $scriptPath -Raw | ssh $sshHost "cd $remoteDir && $compose exec -T postgres psql -v ON_ERROR_STOP=1 -U teamcompass -d teamcompass"
        if ($LASTEXITCODE -ne 0) { throw "Anwenden der SQL-Aenderungen ist fehlgeschlagen (psql-Fehler, per ON_ERROR_STOP abgebrochen). Jede bereits erfolgreich abgeschlossene Migration bleibt angewendet (eigene Transaktion pro Migration), die fehlgeschlagene wurde zurueckgerollt. Backup liegt unter ~/backups/$backupName. Alten Backend-Container NICHT neu starten, bevor die Ursache geklaert ist." }

        Write-Host "Starte neue Backend- und Frontend-Container..."
        ssh $sshHost "cd $remoteDir && $compose up -d backend frontend"
        if ($LASTEXITCODE -ne 0) { throw "Start von Backend/Frontend ist fehlgeschlagen - die DB-Aenderung wurde aber bereits erfolgreich angewendet. Backup liegt unter ~/backups/$backupName. Manuell pruefen: ssh $sshHost `"cd $remoteDir && $compose logs --tail=50`"" }

        Write-Host ""
        Write-Host "Migrations-Status auf dem Server:"
        ssh $sshHost "cd $remoteDir && $compose exec -T postgres psql -U teamcompass -d teamcompass -c 'SELECT * FROM \`"__EFMigrationsHistory\`";'"

        Write-Host ""
        Write-Host "Fertig. Backend und Frontend laufen mit dem neuen Stand. Backup liegt unter ~/backups/$backupName auf dem Server." -ForegroundColor Green
        Write-Host "Logs pruefen: ssh $sshHost `"cd $remoteDir && $compose logs --tail=50`"" -ForegroundColor Green
    }
    finally {
        Remove-Item Env:\ConnectionStrings__Default -ErrorAction SilentlyContinue
    }
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
