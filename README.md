# TeamCompass — Docker

Backend (.NET 10 API), Frontend (TanStack Start/Nitro SSR) und Postgres laufen jeweils in einem eigenen
Container. Lokal (Windows, Docker Desktop) baust und testest du damit denselben Stack, der später auf dem
Strato-Server läuft — Server-seitiges Deployment (inkl. Schritt-für-Schritt-Anleitung) steht in
[deploy.md](deploy.md).

Es gibt **keine** Container-Registry in diesem Setup: sowohl dein Windows-Rechner (lokales Testen) als auch
der Strato-Server bauen die Images jeweils selbst direkt aus dem Git-Repo. Das ist der einfachste Weg, wenn
man mit Linux/Docker noch nicht viel Erfahrung hat — ein Deploy ist einfach `git pull` + ein Befehl.

## Voraussetzungen

- Docker Desktop (Windows), WSL2-Backend aktiv.

## Lokal bauen & starten

Einmalig Secrets anlegen:

```bash
cp .env.docker.example .env.docker
# POSTGRES_PASSWORD etc. anpassen
```

Bauen und starten (die `local`-Overlay-Datei published Frontend/Backend/Postgres zusätzlich auf
`127.0.0.1`, damit du lokal im Browser/mit curl testen kannst — auf dem Server bleibt das zu, siehe
deploy.md):

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.local.yml up --build -d
```

Prüfen:

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.local.yml ps
curl -I http://127.0.0.1:3000
```

Frontend läuft dann unter `http://127.0.0.1:3000`. Stoppen:

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.local.yml down
```

Daten der lokalen Postgres-Instanz überstehen `down` (liegen im benannten Volume `postgres-data`); mit
`down -v` auch die Volumes löschen.

Nach Codeänderungen einfach denselben `up --build -d`-Befehl erneut ausführen — Compose baut nur die
Images neu, deren Quellcode sich geändert hat.

## Struktur

| Datei | Zweck |
|---|---|
| `Backend/Dockerfile` | Multi-Stage-Build des .NET-Backends (SDK → ASP.NET-Runtime-Image) |
| `Dockerfile.frontend` | Multi-Stage-Build des Frontends (Node → Nitro `node-server`-Output) |
| `docker-compose.yml` | Basis-Stack: Postgres, Backend, Frontend — ohne veröffentlichte Ports |
| `docker-compose.local.yml` | Overlay für lokales Testen: published Ports auf `127.0.0.1` |
| `docker-compose.prod.yml` | Overlay für den Server: fügt Caddy hinzu (TLS via Let's Encrypt, Ports 80/443) |
| `Caddyfile` | Reverse-Proxy-Konfiguration für `docker-compose.prod.yml` |
| `.env.docker.example` | Vorlage für Secrets/Konfiguration (`.env.docker` ist gitignored) |

## Warum kein Unterschied zwischen deinem Windows-Rechner und dem Linux-Server?

Beide Dockerfiles bauen reine Linux-Container, und Docker Desktop unter Windows baut über sein
WSL2-Backend selbst schon `linux/amd64`-Images (geprüft mit `docker info --format
'{{.OSType}}/{{.Architecture}}'` → `linux/x86_64`) — dieselbe Architektur wie der Ubuntu-24.04-Server bei
Strato. Da jede Maschine (dein PC lokal, der Server für den echten Betrieb) ihr Image aber ohnehin selbst
aus dem Quellcode baut statt ein fertiges Image von der anderen Maschine zu übernehmen, spielt das hier
praktisch keine Rolle mehr.
