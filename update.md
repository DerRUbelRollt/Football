# Updates ausrollen

Kleinschrittige Anleitung für Updates auf dem Strato-Server, getrennt nach Frontend, Backend und
Datenbank. Setzt voraus, dass der Server bereits nach `deploy.md` eingerichtet ist.

Alle Befehle als `max` per `ssh strato-vm`, im Verzeichnis `/opt/teamcompass/app`:

```bash
cd /opt/teamcompass/app
```

Du läufst bereits mit Domain/HTTPS über Caddy (Schritt 5B abgeschlossen) — alle Befehle unten verwenden
deshalb `docker-compose.prod.yml`.

---

## 0. Vorher immer: Code holen + Backup

```bash
git pull
```

Ein frisches Backup vor jedem Update kostet eine Sekunde und ist die günstigste Versicherung, die es gibt
(Befehl siehe Abschnitt 3 unten, „Backup vor jeder Änderung"). Besonders wichtig, wenn das Update auch
Datenbank-Änderungen enthält.

---

## 1. Nur das Frontend aktualisieren

Wenn sich nur Code unter `src/` oder `Dockerfile.frontend` geändert hat:

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml build frontend
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml up -d frontend
```

- `build frontend`: baut **nur** das Frontend-Image neu (dauert ca. 1–2 Minuten).
- `up -d frontend`: ersetzt **nur** den Frontend-Container durch das neue Image. Backend und Postgres
  laufen währenddessen unverändert weiter, niemand wird ausgeloggt.

Prüfen:

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml logs frontend -f
```

---

## 2. Nur das Backend aktualisieren

Wenn sich nur Code unter `Backend/` geändert hat:

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml build backend
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml up -d backend
```

- `build backend`: baut **nur** das Backend-Image neu.
- `up -d backend`: ersetzt **nur** den Backend-Container. Frontend und Postgres bleiben unberührt.

**Achtung:** Sessions liegen in-memory (siehe `Backend/README.md`) — ein neuer Backend-Container bedeutet,
dass **alle Trainer ausgeloggt werden** und sich neu anmelden müssen. Am besten außerhalb der
Hauptnutzungszeit machen. Die Daten in der Datenbank sind davon nicht betroffen.

Prüfen:

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml logs backend -f
```

---

## 3. Beide zusammen (der Normalfall)

Wenn du dir nicht sicher bist, was sich geändert hat, oder einfach den ganzen Stand aktualisieren willst:

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Das baut automatisch nur die Images neu, deren Quellcode sich seit dem letzten Build geändert hat, und
ersetzt nur die betroffenen Container. Postgres wird dabei **nicht** angefasst, solange sich an dessen
Konfiguration in `docker-compose.yml` nichts geändert hat (Normalfall) — die Datenbank läuft während des
gesamten Updates einfach weiter.

**Backup vor jeder Änderung** (dauert Sekunden, große Datenmengen ausgenommen):

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U teamcompass teamcompass | gzip > /var/backups/teamcompass-$(date +\%F-\%H%M).sql.gz
```

Alte, nicht mehr referenzierte Images danach aufräumen (optional, spart Plattenplatz):

```bash
docker image prune -f
```

---

## 4. Datenbank aktualisieren, ohne Daten zu verlieren

### 4a. Der Normalfall: gar nichts zu tun

Die Postgres-Daten liegen in einem eigenen, benannten Docker-Volume (`postgres-data`, taucht auf dem Server
als `app_postgres-data` auf — der Name kommt vom Ordnernamen `/opt/teamcompass/app`). Dieses Volume ist
**komplett unabhängig vom Container-Lebenszyklus**: Ein Container kann jederzeit gestoppt, neu gebaut oder
ersetzt werden, ohne dass die Daten darin betroffen sind. Updates aus Abschnitt 1–3 oben fassen die
Datenbank nicht an — das ist der Regelfall bei fast jedem App-Update (Bugfixes, neue Features ohne neue
Datenbankfelder).

**Was du deshalb niemals tun solltest**, weil es die Daten tatsächlich löscht:

```bash
# NICHT verwenden, außer du willst wirklich alle Daten löschen:
docker compose ... down -v
docker volume rm app_postgres-data
docker system prune -a --volumes
```

Ganz normales `down` (ohne `-v`) und `up`/`up --build` lassen das Volume unangetastet — die Daten
überleben jeden Neustart, jedes Update, jeden Server-Reboot.

### 4b. Neue Spalte/Tabelle im Code (Schema-Änderung)

Aktuell nutzt das Backend `DbInitializer.EnsureCreated()` (siehe `Backend/Data/DbInitializer.cs`) statt
echter EF-Core-Migrationen. `EnsureCreated()` legt das Schema nur an, wenn die Datenbank **komplett leer**
ist — bei einer bereits bestehenden, befüllten Datenbank passiert bei einer Modelländerung (z. B. neue
Spalte in `Player`) **nichts automatisch**. Ein einfacher Container-Neustart reicht in diesem Fall nicht.

Vorgehen für eine einzelne Schema-Änderung, ohne bestehende Daten zu verlieren:

1. **Zuerst Backup** (siehe Abschnitt 3 oben) — Pflicht, nicht optional, bei Schema-Änderungen.
2. Backend-Image mit dem neuen Code bauen, aber **noch nicht** starten:
   ```bash
   docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml build backend
   ```
3. Passenden `ALTER TABLE`-Befehl manuell in der laufenden Datenbank ausführen (Beispiel für eine neue
   Spalte `notes` in der Tabelle `Players`, Spalten-/Tabellennamen im Zweifel mit `\d "Players"` in `psql`
   prüfen):
   ```bash
   docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
     psql -U teamcompass -d teamcompass -c 'ALTER TABLE "Players" ADD COLUMN "Notes" text;'
   ```
4. Erst danach den neuen Backend-Container starten:
   ```bash
   docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml up -d backend
   ```
5. Kurz die Logs prüfen, ob das Backend fehlerfrei hochkommt:
   ```bash
   docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml logs backend -f
   ```

Falls dabei etwas schiefgeht: Backup aus Schritt 1 einspielen (siehe Abschnitt 4d unten) und nochmal in
Ruhe probieren.

*(Langfristig sauberer wäre die Umstellung auf echte EF-Core-Migrationen, dann übernimmt
`dotnet ef database update` solche Schritte automatisch — steht auch schon als bekannte Einschränkung in
`deploy.md`.)*

### 4c. Die Postgres-Version selbst aktualisieren (z. B. von 15 auf 16)

Ein Versionswechsel des Postgres-**Images** ist etwas anderes als ein normales App-Update: Postgres kann
sein Datenverzeichnis nicht ohne Weiteres zwischen Hauptversionen (z. B. 15 → 16) weiterverwenden — ein
neuer Container mit `image: postgres:16-alpine`, der auf dasselbe Volume zeigt, startet in diesem Fall
nicht einfach durch. Nötig ist ein Dump-und-Wiederherstellen-Verfahren:

1. **Backup mit der alten Version** (Container läuft noch auf `postgres:15-alpine`):
   ```bash
   docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
     pg_dump -U teamcompass teamcompass | gzip > /var/backups/vor-postgres-upgrade.sql.gz
   ```
2. Stack stoppen:
   ```bash
   docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml down
   ```
3. In `docker-compose.yml` die Zeile `image: postgres:15-alpine` auf die neue Version ändern (z. B.
   `image: postgres:16-alpine`).
4. Das alte Volume beiseiteschieben, statt es zu löschen (Sicherheitsnetz, falls etwas schiefgeht) —
   Docker benennt Volumes nicht um, deshalb ein neues Volume für die neue Version anlegen: in
   `docker-compose.yml` den Volume-Namen z. B. zu `postgres-data-v16` ändern.
5. Stack neu starten — Postgres 16 legt jetzt eine **leere** Datenbank im neuen Volume an:
   ```bash
   docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml up -d postgres
   ```
6. Backup aus Schritt 1 in die neue, leere Datenbank einspielen:
   ```bash
   gunzip -c /var/backups/vor-postgres-upgrade.sql.gz | \
     docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
     psql -U teamcompass -d teamcompass
   ```
7. Backend und Frontend wieder starten:
   ```bash
   docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```
8. Erst wenn alles bestätigt läuft, das alte Volume (`app_postgres-data`, die 15er-Version) endgültig
   löschen:
   ```bash
   docker volume rm app_postgres-data
   ```

Das ist ein seltener Vorgang (nur bei einem bewussten Versionswechsel nötig) — für normale App-Updates
(Abschnitt 1–3) bleibt die Postgres-Version unverändert und dieser Abschnitt ist nicht relevant.

### 4d. Backup zurückspielen (falls ein Update die Daten beschädigt hat)

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  psql -U teamcompass -d teamcompass -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
gunzip -c /var/backups/teamcompass-<DATUM>.sql.gz | \
  docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  psql -U teamcompass -d teamcompass
```

Der `DROP SCHEMA ... CASCADE`-Befehl löscht **alles** in der aktuellen Datenbank, bevor der Dump
eingespielt wird — nur ausführen, wenn du den aktuellen Stand bewusst durch das Backup ersetzen willst.

---

## 5. Rollback (Update war fehlerhaft, Code zurückdrehen)

```bash
git log --oneline -5        # den Commit-Hash vor dem fehlerhaften Update raussuchen
git checkout <COMMIT-HASH>
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml up --build -d
git checkout main           # danach wieder auf den aktuellen Stand wechseln, sobald der Fix da ist
```

Betrifft nur den App-Code — die Datenbank ist von einem Code-Rollback nicht betroffen (siehe 4a), außer
das fehlerhafte Update hatte auch eine Schema-Änderung (siehe 4b) durchgeführt, dann zusätzlich das Backup
aus 4d vor dem Rollback einspielen.
