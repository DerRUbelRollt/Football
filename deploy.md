# Deploy auf einem Strato V-Server

Ziel: Domain bleibt bei Strato, läuft aber auf einem gemieteten Strato-V-Server (Root-Zugriff)
mit dem bestehenden Stack unverändert — kein Rewrite von Backend oder Frontend nötig.

## Zielarchitektur

```
Browser
   |  HTTPS (443)
   v
Nginx (TLS-Terminierung, Let's Encrypt)
   |  HTTP, 127.0.0.1:3000
   v
Node-Prozess (Frontend, TanStack Start/Nitro SSR)      <- systemd: teamcompass-frontend
   |  HTTP, 127.0.0.1:5000 (nur intern, nicht oeffentlich)
   v
.NET-Prozess (Backend, ASP.NET Core API)                <- systemd: teamcompass-backend
   |  127.0.0.1:5432
   v
PostgreSQL (lokal, nur localhost erreichbar)
```

Nur Nginx ist öffentlich erreichbar (Port 80/443). Backend und PostgreSQL hören ausschließlich
auf `127.0.0.1` und sind von außen nicht ansprechbar — die Firewall lässt ihre Ports gar nicht erst durch.

## Voraussetzungen

- Zugriff auf das Strato-Kundenpanel (zum Bestellen des Servers und für die DNS-Verwaltung der Domain).
- Der Domain-Ordner/FTP-Zugang vom bisherigen Webhosting-Paket bleibt bestehen, wird für diese Domain aber nicht mehr genutzt, sobald die DNS umgestellt ist (Schritt 8).

Bewusst **kein Plesk** aktivieren, obwohl es allen Strato-V-Server-Tarifen kostenlos beiliegt: Plesk frisst bei 4 GB RAM einen spürbaren Teil des Budgets. Nginx + Certbot manuell einzurichten ist bei SSH-Erfahrung genauso schnell und schlanker.

---

## 0. V-Server bei Strato bestellen

- Auf strato.de → „Server" → Linux-V-Server auswählen.
- Tarif mit **2 vCores / 4 GB RAM / 40 GB NVMe** wählen (reicht für 50 Nutzer/5-10 gleichzeitig komfortabel).
- Als Betriebssystem **Ubuntu 24.04 LTS** auswählen.
- Rechenzentrums-Standort **Deutschland**.
- Falls im Bestellprozess abgefragt: eigenen SSH-Public-Key hochladen (spart den Key-Schritt weiter unten) — sonst kommt ein root-Passwort per E-Mail/Kundenpanel.
- Bestellung abschließen; IP-Adresse und Zugangsdaten kommen per E-Mail bzw. stehen im Kundenpanel.

(Die genauen Klickpfade im Strato-Bestellprozess können von der aktuellen Panel-Version abweichen — die Eckdaten oben sind das, worauf es ankommt.)

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

Swap-Space anlegen — bei 4 GB RAM ein günstiges Sicherheitsnetz gegen abrupte OOM-Kills bei Lastspitzen (z. B. während `npm run build`):

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Ab hier alle Befehle als `<dein-username>` mit `sudo`, nicht mehr als root.

---

## 2. Laufzeiten installieren

**.NET 10 SDK** (in Ubuntu 24.04 direkt im Standard-Repo enthalten, kein extra Microsoft-Repo nötig):

```bash
sudo apt-get update
sudo apt-get install -y dotnet-sdk-10.0
```

**Node.js 24 LTS** (über NodeSource, da Ubuntu 24.04 selbst eine ältere Node-Version mitbringt):

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
sudo apt-get install -y nodejs
node --version   # sollte v24.x zeigen
```

**PostgreSQL, Nginx, Git, Certbot:**

```bash
sudo apt-get install -y postgresql nginx git certbot python3-certbot-nginx
```

PostgreSQL ist nach der Installation bereits standardmäßig nur auf `localhost` erreichbar — kein zusätzliches Härten nötig.

---

## 3. PostgreSQL einrichten

```bash
sudo -u postgres psql -c "CREATE ROLE teamcompass WITH LOGIN PASSWORD '<STARKES-PASSWORT>';"
sudo -u postgres psql -c "CREATE DATABASE teamcompass OWNER teamcompass;"
```

Verwende ein neues, starkes Passwort — nicht die Dev-Zugangsdaten aus `Backend/appsettings.Development.json`.

---

## 4. Code auf den Server holen

```bash
sudo mkdir -p /opt/teamcompass
sudo chown "$USER" /opt/teamcompass
git clone https://github.com/DerRUbelRollt/Football.git /opt/teamcompass/app
```

Falls das Repo privat ist, entweder einen Personal-Access-Token in der URL verwenden oder (sauberer) einen
Deploy-Key auf dem Server erzeugen (`ssh-keygen`) und als Read-only Deploy Key in den GitHub-Repo-Einstellungen hinterlegen.

---

## 5. Backend bauen und als systemd-Service einrichten

```bash
cd /opt/teamcompass/app
dotnet publish Backend/TeamCompass.Api.csproj -c Release -o /opt/teamcompass/backend-publish
```

Env-Datei mit den Produktions-Secrets anlegen (bewusst **nicht** in `appsettings.Production.json`, die liegt im Git-Repo):

```bash
sudo mkdir -p /etc/teamcompass
sudo tee /etc/teamcompass/backend.env > /dev/null <<'EOF'
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://127.0.0.1:5000
ConnectionStrings__Default=Host=127.0.0.1;Port=5432;Username=teamcompass;Password=<STARKES-PASSWORT>;Database=teamcompass
EOF
sudo chmod 640 /etc/teamcompass/backend.env
```

`/etc/systemd/system/teamcompass-backend.service`:

```ini
[Unit]
Description=TeamCompass Backend (.NET API)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=teamcompass
Group=teamcompass
WorkingDirectory=/opt/teamcompass/backend-publish
EnvironmentFile=/etc/teamcompass/backend.env
ExecStart=/usr/bin/dotnet /opt/teamcompass/backend-publish/TeamCompass.Api.dll
Restart=always
RestartSec=5
SyslogIdentifier=teamcompass-backend

[Install]
WantedBy=multi-user.target
```

Prüfe vorher mit `which dotnet`, ob der Pfad bei dir abweicht.

Mit `ConnectionStrings:Default` gesetzt und `ASPNETCORE_ENVIRONMENT=Production` verwendet das Backend genau die Produktionsabsicherung aus `Backend/Program.cs`: Fehlt die Variable, bricht der Start sofort mit einer klaren Fehlermeldung ab, statt gegen die lokale Dev-DB zu laufen.

---

## 6. Frontend bauen und als systemd-Service einrichten

```bash
cd /opt/teamcompass/app
npm ci
NITRO_PRESET=node-server npm run build
```

`NITRO_PRESET=node-server` ist nötig, weil der Zero-Config-Build sonst einen Cloudflare-Worker baut (für den Lovable-Workflow, unverändert). Das Ergebnis liegt in `.output/` und ist in sich geschlossen (eigenes `node_modules`, eigener `public/`-Ordner) — verifiziert per Testlauf ohne das Projekt-`node_modules`.

Env-Datei fürs Frontend:

```bash
sudo tee /etc/teamcompass/frontend.env > /dev/null <<'EOF'
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
BACKEND_URL=http://127.0.0.1:5000
EOF
sudo chmod 640 /etc/teamcompass/frontend.env
```

`/etc/systemd/system/teamcompass-frontend.service`:

```ini
[Unit]
Description=TeamCompass Frontend (Node/Nitro SSR)
After=network.target teamcompass-backend.service
Wants=teamcompass-backend.service

[Service]
Type=simple
User=teamcompass
Group=teamcompass
WorkingDirectory=/opt/teamcompass/app
EnvironmentFile=/etc/teamcompass/frontend.env
ExecStart=/usr/bin/node /opt/teamcompass/app/.output/server/index.mjs
Restart=always
RestartSec=5
SyslogIdentifier=teamcompass-frontend

[Install]
WantedBy=multi-user.target
```

Prüfe vorher mit `which node`, ob der Pfad bei dir abweicht.

**Dedizierten Service-User anlegen und Rechte setzen, dann beide Services starten:**

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin teamcompass
sudo chown -R teamcompass:teamcompass /opt/teamcompass

sudo systemctl daemon-reload
sudo systemctl enable --now teamcompass-backend
sudo systemctl enable --now teamcompass-frontend

systemctl status teamcompass-backend teamcompass-frontend
```

---

## 7. Nginx als Reverse Proxy + TLS

`/etc/nginx/sites-available/teamcompass`:

```nginx
server {
    listen 80;
    server_name <deine-domain.tld> www.<deine-domain.tld>;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/teamcompass /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

TLS-Zertifikat holen (baut den 443-Server-Block und die Weiterleitung automatisch in die Config ein):

```bash
sudo certbot --nginx -d <deine-domain.tld> -d www.<deine-domain.tld>
sudo certbot renew --dry-run   # Auto-Renewal testen
```

---

## 8. Domain-DNS bei Strato umstellen

Im Strato-Kundenpanel: Domains → `<deine-domain.tld>` → DNS-Verwaltung.

- Bestehenden **A-Record** (zeigt aktuell auf das Webhosting-Paket) auf die neue VPS-IP ändern.
- Für `www` ebenfalls einen A-Record (oder CNAME auf die Hauptdomain) anlegen.
- DNS-Umstellung kann bis zu 24h propagieren, meist deutlich schneller.

Das Webhosting-Paket selbst bleibt bestehen und nutzbar — es bekommt nur keinen Traffic mehr über diese Domain, sobald die DNS umgezogen ist.

---

## 9. Verifizieren

```bash
curl -I http://127.0.0.1:3000          # Frontend antwortet lokal
curl -I http://127.0.0.1:5000/api      # Backend antwortet lokal (Pfad je nach Route anpassen)
sudo journalctl -u teamcompass-backend -f    # Live-Logs Backend
sudo journalctl -u teamcompass-frontend -f   # Live-Logs Frontend
```

Danach im Browser: `https://<deine-domain.tld>` aufrufen, Zertifikat prüfen (Schloss-Symbol), Login-Flow testen.

**Reboot-Test**: einmal durchstarten und prüfen, dass wirklich alles automatisch wieder hochkommt (die Services sind bereits `enable`d, sollten also von selbst starten):

```bash
sudo reboot
# kurz warten, dann erneut per SSH einloggen
systemctl status teamcompass-backend teamcompass-frontend nginx postgresql
```

**Sofort nach dem ersten Start:** Mit dem automatisch angelegten Default-Trainer einloggen (`Trainer` / `12345678`, siehe `Backend/Data/DbInitializer.cs`) und **sofort unter „Einstellungen" das Passwort ändern** (öffentliches Signup gibt es nicht mehr — neue Trainer-Accounts werden ausschließlich von bereits angemeldeten Trainern über die Einstellungsseite angelegt).

---

## 10. Künftige Updates ausrollen

```bash
cd /opt/teamcompass/app
git pull

dotnet publish Backend/TeamCompass.Api.csproj -c Release -o /opt/teamcompass/backend-publish
NITRO_PRESET=node-server npm ci && NITRO_PRESET=node-server npm run build

sudo chown -R teamcompass:teamcompass /opt/teamcompass
sudo systemctl restart teamcompass-backend
sudo systemctl restart teamcompass-frontend
```

Sessions liegen in-memory (siehe `Backend/README.md`) — ein Neustart von `teamcompass-backend` loggt alle Trainer aus. Bei 50 Nutzern unkritisch, aber am besten außerhalb der Hauptnutzungszeit deployen.

---

## 11. Backups

Strato-V-Server-Tarife enthalten standardmäßig **keine** automatischen Backups. Minimaler eigener Schutz für die Datenbank:

```bash
sudo -u postgres pg_dump teamcompass | gzip > /var/backups/teamcompass-$(date +\%F).sql.gz
```

Als Cronjob (z. B. täglich um 3 Uhr) einrichten und die Dumps zusätzlich offsite kopieren (z. B. per `scp`/`rclone` auf einen anderen Rechner/Cloud-Speicher) — ein Backup, das nur auf demselben Server liegt, schützt nicht vor Server-Totalausfall.

---

## Bekannte Einschränkungen (bewusst nicht in diesem Schritt behoben)

- **Secure-Cookie-Flag**: `Backend/Services/SessionCookie.cs:20` setzt `Secure = request.IsHttps`. Da das Backend nur intern per HTTP von Node aus erreicht wird, ist das immer `false` — das Session-Cookie bekommt kein `Secure`-Flag, obwohl die Seite über HTTPS läuft. Funktioniert trotzdem (Login/Session funktionieren normal), ist aber kein vollständig korrektes Secure-Cookie-Setup.
- **In-memory Sessions**: kein Redis o. Ä., jeder Backend-Neustart loggt alle Trainer aus. Für diese Nutzerzahl unkritisch.
- **`DbInitializer.EnsureCreated()`**: legt das Schema direkt an statt über EF-Migrationen und seedet automatisch einen Default-Trainer. Für spätere Schema-Änderungen sollte das auf echte Migrationen umgestellt werden.
- **Kein Trainer-Listing/-Löschen**: `POST /auth/trainers` legt Konten an, aber es gibt keine Möglichkeit, bestehende Trainer-Accounts einzusehen oder zu entfernen. Ein über den Default-Account angelegtes Konto bleibt daher auch nach einem späteren Passwortwechsel des Default-Trainers unsichtbar und nicht entziehbar — ein weiterer Grund, das Default-Passwort sofort nach dem ersten Login zu ändern.
- **Kein CI/CD**: Updates laufen aktuell manuell nach Schritt 10. Ließe sich später per GitHub Actions automatisieren.
- **Keine automatischen OS-Sicherheitsupdates**: `sudo apt install unattended-upgrades` wäre ein sinnvoller zusätzlicher Härtungsschritt.
