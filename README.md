# TeamCompass — Docker

Backend (.NET 10 API), Frontend (TanStack Start/Nitro SSR) und Postgres laufen jeweils in einem eigenen
Container. Lokal (Windows, Docker Desktop) baust und testest du damit exakt das, was später auf dem
Strato-Server läuft — Server-seitiges Deployment steht in [deploy.md](deploy.md).

## Voraussetzungen

- Docker Desktop (Windows), WSL2-Backend aktiv.
- Für den Push in eine Registry: ein GitHub-Account mit Zugriff auf dieses Repo.

## Sind Windows- und Linux-Build unterschiedlich?

Nein, in diesem Setup nicht — beide Dockerfiles bauen reine Linux-Container. Docker Desktop unter Windows
baut über sein WSL2-Backend selbst schon `linux/amd64`-Images (geprüft mit `docker info --format
'{{.OSType}}/{{.Architecture}}'` → `linux/x86_64`), exakt dieselbe Architektur wie der Ubuntu-24.04-Server
bei Strato. Ein auf diesem Windows-Rechner gebautes Image läuft 1:1 auf dem Server — es gibt hier **keinen**
Grund für getrennte Build-Anleitungen.

Der einzige Fall, in dem das *nicht* mehr stimmt: Build auf einem ARM-Rechner (z. B. Apple-Silicon-Mac).
Dann explizit die Ziel-Architektur erzwingen:

```bash
docker build --platform linux/amd64 ...
```

(unten in den Befehlen bereits der Vollständigkeit halber mit `--platform linux/amd64` versehen — schadet
auf x86_64 nicht, schützt aber, falls du später von einem anderen Rechner aus baust).

## Lokal bauen & starten (ohne Registry)

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

## Images einzeln bauen (ohne Compose)

Nützlich, um ein einzelnes Image zu taggen/zu pushen, ohne den ganzen Stack neu zu starten.

**Backend:**

```bash
docker build --platform linux/amd64 -t ghcr.io/derrubelrollt/teamcompass-backend:latest ./Backend
```

**Frontend:**

```bash
docker build --platform linux/amd64 -f Dockerfile.frontend -t ghcr.io/derrubelrollt/teamcompass-frontend:latest .
```

(`derrubelrollt` durch deinen tatsächlichen GitHub-Namen in Kleinschreibung ersetzen — GHCR verlangt
lowercase Image-Namen.)

## In die Registry pushen (GitHub Container Registry)

Einmalig ein Personal Access Token mit Scope `write:packages` (und `read:packages` für den Server-Pull)
erstellen: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic).

```bash
echo '<DEIN-GHCR-TOKEN>' | docker login ghcr.io -u <dein-github-username> --password-stdin

docker push ghcr.io/derrubelrollt/teamcompass-backend:latest
docker push ghcr.io/derrubelrollt/teamcompass-frontend:latest
```

Standardmäßig sind neu gepushte GHCR-Packages **privat**. Entweder auf „public" stellen (GitHub → dein
Profil → Packages → Package → Package settings) oder auf dem Server ebenfalls `docker login ghcr.io`
ausführen (Token braucht dafür nur `read:packages`) — Details dazu in deploy.md, Schritt 3.

Danach auf dem Server nur noch `docker compose pull && docker compose up -d` (siehe deploy.md) — dort wird
kein `git clone` der vollen Toolchain, kein .NET-SDK und kein Node benötigt, nur Docker selbst.

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
