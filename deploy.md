# Deploy auf einem Strato V-Server (Docker)

Ziel: Domain bleibt bei Strato, läuft aber auf einem gemieteten Strato-V-Server (Root-Zugriff).
Gebaut wird lokal (Windows) oder in CI, auf dem Server läuft ausschließlich Docker — kein .NET-SDK,
kein Node, kein manuelles `dotnet publish`/`npm run build` auf der Maschine, die produktiv läuft.

Genaue Build-Befehle (lokal, mit den fertigen Images testen) stehen in [README.md](README.md).
Dieses Dokument behandelt nur das Server-seitige Deployment.

## Zielarchitektur

```
Browser
   |  HTTPS (443)
   v
Caddy-Container (TLS-Terminierung, automatisches Let's Encrypt)
   |  HTTP, docker-internes Netz
   v
Frontend-Container (Node/Nitro SSR)       <- ghcr.io/.../teamcompass-frontend
   |  HTTP, docker-internes Netz
   v
Backend-Container (ASP.NET Core API)      <- ghcr.io/.../teamcompass-backend
   |  docker-internes Netz
   v
Postgres-Container (Volume auf dem Host)
```

Nur Caddy publiziert Ports auf den Host (80/443). Backend, Frontend und Postgres hängen im selben
Docker-Netzwerk und sind untereinander per Servicename erreichbar (`backend`, `frontend`, `postgres`) —
sie haben **keine** an den Host gebundenen Ports und sind von außen nicht ansprechbar. Das ist wichtiger
als bei der alten systemd-Variante: Docker trägt eigene iptables-Regeln ein und kann dabei eine
UFW-„deny"-Regel umgehen, wenn ein Port versehentlich mit `ports:` auf `0.0.0.0` publiziert wird —
deshalb im Zweifel nie `ports:` auf Backend/Frontend/Postgres in `docker-compose.prod.yml` ergänzen.

## Voraussetzungen

- Zugriff auf das Strato-Kundenpanel (zum Bestellen des Servers und für die DNS-Verwaltung der Domain).
- Ein Container-Registry-Account, in den die Images gepusht werden — empfohlen: **GitHub Container
  Registry (`ghcr.io`)**, da direkt am bestehenden GitHub-Repo hängend und kostenlos für private/öffentliche
  Images. Setup dafür steht in README.md.
- Der Domain-Ordner/FTP-Zugang vom bisherigen Webhosting-Paket bleibt bestehen, wird für diese Domain aber
  nicht mehr genutzt, sobald die DNS umgestellt ist (Schritt 7).

Bewusst **kein Plesk** aktivieren: Plesk frisst bei 4 GB RAM einen spürbaren Teil des Budgets und Docker
braucht ohnehin keine Panel-Verwaltung.

---

## 0. V-Server bei Strato bestellen

- Auf strato.de → „Server" → Linux-V-Server auswählen.
- Tarif mit **2 vCores / 4 GB RAM / 40 GB NVMe** wählen (reicht für 50 Nutzer/5-10 gleichzeitig komfortabel).
- Als Betriebssystem **Ubuntu 24.04 LTS** auswählen.
- Rechenzentrums-Standort **Deutschland**.
- Falls im Bestellprozess abgefragt: eigenen SSH-Public-Key hochladen (spart den Key-Schritt weiter unten) —
  sonst kommt ein root-Passwort per E-Mail/Kundenpanel.
- Bestellung abschließen; IP-Adresse und Zugangsdaten kommen per E-Mail bzw. stehen im Kundenpanel.

(Die genauen Klickpfade im Strato-Bestellprozess können von der aktuellen Panel-Version abweichen — die
Eckdaten oben sind das, worauf es ankommt.)

---

## 1. Server-Grundabsicherung

Als `root` einloggen:

```bash
ssh root@<VPS-IP>
apt update && apt upgrade -y
```

Eigenen sudo-User anlegen (nicht dauerhaft als root arbeiten):

```bash
adduser <dein-username>
usermod -aG sudo <dein-username>
```

SSH-Key-Login einrichten (falls noch nicht beim Bestellen hinterlegt) und danach Passwort-Login abschalten:

```bash
# Lokal auf deinem Rechner, falls noch kein Key existiert:
ssh-keygen -t ed25519 -C "teamcompass-deploy"
ssh-copy-id <dein-username>@<VPS-IP>

# Auf dem Server, in /etc/ssh/sshd_config:
#   PasswordAuthentication no
#   PermitRootLogin no
sudo systemctl restart ssh
```

Firewall — **erst SSH erlauben, dann aktivieren**, sonst sperrst du dich aus:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Optional, aber empfohlen (SSH-Bruteforce-Schutz):

```bash
sudo apt install -y fail2ban
```

Swap-Space anlegen — bei 4 GB RAM ein günstiges Sicherheitsnetz gegen abrupte OOM-Kills bei Lastspitzen:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Ab hier alle Befehle als `<dein-username>` mit `sudo`, nicht mehr als root.

---

## 2. Docker installieren

Kein .NET-SDK, kein Node, kein PostgreSQL-Paket nötig — nur Docker Engine + Compose-Plugin:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

Danach einmal aus- und wieder einloggen, damit die Gruppenmitgliedschaft greift. Prüfen:

```bash
docker --version
docker compose version
```

---

## 3. Registry-Zugang auf dem Server einrichten

Damit `docker compose pull` die privat gehosteten Images ziehen kann, einmalig bei der Registry einloggen
(Personal Access Token mit `read:packages`-Scope, siehe README.md):

```bash
echo '<GHCR-TOKEN>' | docker login ghcr.io -u <dein-github-username> --password-stdin
```

---

## 4. Deploy-Dateien auf den Server holen

Es wird **kein vollständiger Checkout mit Node/.NET-Toolchain** benötigt — nur die Compose-/Config-Dateien.
Einfachster Weg: das Repo klonen (die Dateien sind klein, das schadet nicht) und nur damit arbeiten:

```bash
sudo mkdir -p /opt/teamcompass
sudo chown "$USER" /opt/teamcompass
git clone https://github.com/DerRUbelRollt/Football.git /opt/teamcompass/app
cd /opt/teamcompass/app
```

Falls das Repo privat ist, entweder einen Personal-Access-Token in der URL verwenden oder (sauberer) einen
Deploy-Key auf dem Server erzeugen (`ssh-keygen`) und als Read-only Deploy Key in den GitHub-Repo-Einstellungen
hinterlegen.

---

## 5. Secrets konfigurieren

```bash
cp .env.docker.example .env.docker
nano .env.docker
```

Ausfüllen:

- `POSTGRES_PASSWORD`: neues, starkes Passwort — nicht die Dev-Zugangsdaten aus `Backend/appsettings.Development.json`.
- `BACKEND_IMAGE` / `FRONTEND_IMAGE`: die in README.md gepushten Image-Tags (z. B. `ghcr.io/derrubelrollt/teamcompass-backend:latest`).
- `DOMAIN`: die tatsächliche Domain, z. B. `teamcompass.example.de` (Caddy holt darüber automatisch das Let's-Encrypt-Zertifikat).

`.env.docker` bewusst **nicht** einchecken (steht in `.gitignore`) — Berechtigungen einschränken:

```bash
chmod 600 .env.docker
```

---

## 6. Container starten

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml up -d
```

`docker-compose.prod.yml` fügt den Caddy-Container hinzu, der Port 80/443 öffentlich published und automatisch
ein Let's-Encrypt-Zertifikat für `DOMAIN` holt — kein manuelles Nginx/Certbot-Setup nötig.

Status prüfen:

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml logs -f
```

---

## 7. Domain-DNS bei Strato umstellen

Im Strato-Kundenpanel: Domains → `<deine-domain.tld>` → DNS-Verwaltung.

- Bestehenden **A-Record** (zeigt aktuell auf das Webhosting-Paket) auf die neue VPS-IP ändern.
- Für `www` ebenfalls einen A-Record (oder CNAME auf die Hauptdomain) anlegen.
- DNS-Umstellung kann bis zu 24h propagieren, meist deutlich schneller.

Das Webhosting-Paket selbst bleibt bestehen und nutzbar — es bekommt nur keinen Traffic mehr über diese
Domain, sobald die DNS umgezogen ist.

---

## 8. Verifizieren

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml logs backend -f
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml logs frontend -f
```

Danach im Browser: `https://<deine-domain.tld>` aufrufen, Zertifikat prüfen (Schloss-Symbol), Login-Flow
testen.

**Reboot-Test**: einmal durchstarten und prüfen, dass wirklich alles automatisch wieder hochkommt
(`restart: unless-stopped` sorgt dafür, dass Docker die Container nach einem Reboot selbst wieder startet,
sofern der Docker-Daemon per systemd `enable`d ist — das macht `get.docker.com` automatisch):

```bash
sudo reboot
# kurz warten, dann erneut per SSH einloggen
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml ps
```

**Sofort nach dem ersten Start:** Mit dem automatisch angelegten Default-Trainer einloggen
(`Trainer` / `12345678`, siehe `Backend/Data/DbInitializer.cs`) und **sofort unter „Einstellungen" das
Passwort ändern** (öffentliches Signup gibt es nicht mehr — neue Trainer-Accounts werden ausschließlich von
bereits angemeldeten Trainern über die Einstellungsseite angelegt).

---

## 9. Künftige Updates ausrollen

Neue Images lokal bauen und pushen (siehe README.md), dann auf dem Server:

```bash
cd /opt/teamcompass/app
git pull   # nur relevant, falls sich Compose-/Caddy-Config geändert hat
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml up -d
```

`up -d` nach einem `pull` ersetzt nur die Container, deren Image sich geändert hat, mit minimaler
Downtime. Sessions liegen in-memory (siehe `Backend/README.md`) — ein Neustart des Backend-Containers
loggt alle Trainer aus. Bei 50 Nutzern unkritisch, aber am besten außerhalb der Hauptnutzungszeit deployen.

Alte, nicht mehr referenzierte Images aufräumen (spart Plattenplatz auf 40 GB NVMe):

```bash
docker image prune -f
```

---

## 10. Backups

Strato-V-Server-Tarife enthalten standardmäßig **keine** automatischen Backups. Minimaler eigener Schutz
für die Datenbank (Dump aus dem laufenden Postgres-Container):

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U teamcompass teamcompass | gzip > /var/backups/teamcompass-$(date +\%F).sql.gz
```

Als Cronjob (z. B. täglich um 3 Uhr) einrichten und die Dumps zusätzlich offsite kopieren (z. B. per
`scp`/`rclone` auf einen anderen Rechner/Cloud-Speicher) — ein Backup, das nur auf demselben Server liegt,
schützt nicht vor Server-Totalausfall. Das Postgres-Datenverzeichnis selbst liegt im benannten Volume
`postgres-data` und übersteht Container-Neustarts/-Updates unverändert.

---

## Bekannte Einschränkungen (bewusst nicht in diesem Schritt behoben)

- **Secure-Cookie-Flag**: `Backend/Services/SessionCookie.cs:20` setzt `Secure = request.IsHttps`. Da das
  Backend nur intern per HTTP von Caddy/Frontend aus erreicht wird, ist das immer `false` — das
  Session-Cookie bekommt kein `Secure`-Flag, obwohl die Seite über HTTPS läuft. Funktioniert trotzdem
  (Login/Session funktionieren normal), ist aber kein vollständig korrektes Secure-Cookie-Setup.
- **In-memory Sessions**: kein Redis o. Ä., jeder Backend-Neustart loggt alle Trainer aus. Für diese
  Nutzerzahl unkritisch.
- **`DbInitializer.EnsureCreated()`**: legt das Schema direkt an statt über EF-Migrationen und seedet
  automatisch einen Default-Trainer. Für spätere Schema-Änderungen sollte das auf echte Migrationen
  umgestellt werden.
- **Kein Trainer-Listing/-Löschen**: `POST /auth/trainers` legt Konten an, aber es gibt keine Möglichkeit,
  bestehende Trainer-Accounts einzusehen oder zu entfernen. Ein über den Default-Account angelegtes Konto
  bleibt daher auch nach einem späteren Passwortwechsel des Default-Trainers unsichtbar und nicht
  entziehbar — ein weiterer Grund, das Default-Passwort sofort nach dem ersten Login zu ändern.
- **Kein CI/CD**: Images werden aktuell manuell gebaut und gepusht (siehe README.md). Ließe sich später per
  GitHub Actions automatisieren (Build+Push bei jedem Push auf `main`).
- **Keine automatischen OS-Sicherheitsupdates**: `sudo apt install unattended-upgrades` wäre ein sinnvoller
  zusätzlicher Härtungsschritt für den Host selbst (unabhängig von Docker).
