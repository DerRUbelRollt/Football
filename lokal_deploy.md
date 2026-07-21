# Lokales Docker aktualisieren (Windows)

Kurzanleitung, um deinen lokalen Docker-Stack (Docker Desktop, Windows) auf den aktuellen Code-Stand zu
bringen. Gilt für dein lokales Testsetup aus `README.md` — nicht für den Strato-Server (dafür `update.md`).

Alle Befehle im Repo-Root (`d:\vsCode\Football`), z. B. in Git Bash:

```bash
cd d:/vsCode/Football
```

Läuft mit `docker-compose.yml` + `docker-compose.local.yml` (published Ports auf `127.0.0.1`, kein Caddy,
keine Domain nötig).

---

## 1. Nur das Frontend aktualisieren

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.local.yml build frontend
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.local.yml up -d frontend
```

Baut nur das Frontend-Image aus dem aktuellen Stand von `src/`/`Dockerfile.frontend` neu und ersetzt nur
den Frontend-Container. Backend und Postgres laufen unverändert weiter.

---

## 2. Nur das Backend aktualisieren

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.local.yml build backend
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.local.yml up -d backend
```

Baut nur das Backend-Image aus dem aktuellen Stand von `Backend/` neu. Da lokal ohnehin nur du testest,
spielt der Session-Verlust beim Backend-Neustart keine Rolle.

---

## 3. Beide zusammen (der Normalfall)

Am einfachsten, wenn du dir nicht sicher bist, was sich geändert hat:

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.local.yml up --build -d
```

Baut automatisch nur die Images neu, deren Quellcode sich seit dem letzten Build geändert hat.

Prüfen, ob alles läuft:

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.local.yml ps
curl -I http://127.0.0.1:3000
```

Logs bei Bedarf:

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.local.yml logs -f
```

Stoppen (Container weg, Daten bleiben):

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.local.yml down
```

---

## 4. Lokale Datenbank

### Normalfall: Daten bleiben automatisch erhalten

Die lokalen Postgres-Daten liegen im benannten Docker-Volume `football_postgres-data`, unabhängig vom
Container-Lebenszyklus. Alle Befehle oben (`build`, `up`, `up --build`, `down` ohne `-v`) lassen dieses
Volume unangetastet — deine lokalen Testdaten (Trainer, Spieler, Ereignisse) überleben jeden Rebuild.

### Absichtlich sauberer Neustart (nur lokal sinnvoll)

Anders als auf dem Server willst du beim lokalen Testen manchmal bewusst wieder bei einer leeren Datenbank
anfangen (z. B. um den Erststart mit Default-Trainer erneut zu testen). Dafür **explizit** `-v`:

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.local.yml down -v
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.local.yml up --build -d
```

Das löscht das Volume `football_postgres-data` und legt beim nächsten Start eine leere Datenbank mit dem
automatisch angelegten Default-Trainer (`Trainer` / `12345678`) an.

### Schema-Änderung (neue Spalte/Tabelle im Code)

Gleiche Einschränkung wie auf dem Server: `DbInitializer.EnsureCreated()` zieht Änderungen an bestehenden
Tabellen nicht automatisch nach. Für lokales Testen ist der einfachste Weg meistens der Reset aus dem
Abschnitt oben (`down -v` + `up --build -d`) — lokale Testdaten sind ja beliebig neu anlegbar. Willst du
stattdessen wie auf dem Server ein `ALTER TABLE` von Hand ausführen, ohne die lokalen Daten zu verlieren,
siehe `update.md`, Abschnitt 4b (Befehle 1:1 übertragbar, nur `docker-compose.prod.yml` durch
`docker-compose.local.yml` ersetzen).

---

## 5. Alles komplett neu bauen (Cache verwerfen)

Falls ein Build seltsame/alte Stände zeigt und ein normaler Rebuild nicht hilft:

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.local.yml build --no-cache
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.local.yml up -d
```

`--no-cache` ignoriert alle gecachten Docker-Layer und baut wirklich alles neu — dauert entsprechend
länger als ein normaler Build.
