# Deploy auf einem Strato V-Server (Docker)

Ziel: Domain bleibt bei Strato, läuft aber auf einem gemieteten Strato-V-Server (Root-Zugriff).
Auf dem Server wird **nur Docker installiert** — kein .NET-SDK, kein Node, kein PostgreSQL-Paket, kein
manuelles `dotnet publish`/`npm run build` von Hand. Docker baut die Images direkt aus dem geklonten
Git-Repo; du musst dafür keine Linux-Kommandozeilen-Erfahrung mitbringen, jeder Befehl unten steht zum
Copy-Pasten da.

Genaue Erklärung der einzelnen Dateien (Dockerfiles, Compose-Overlays) steht in [README.md](README.md).
Dieses Dokument ist die Schritt-für-Schritt-Anleitung für den Server.

## Zielarchitektur

Solange keine Domain vorhanden ist (aktueller Stand, Schritt 5A), ist das Frontend direkt per HTTP über
die VPS-IP erreichbar — noch kein Caddy, noch kein TLS:

```
Browser
   |  HTTP (80), ueber die VPS-IP
   v
Frontend-Container (Node/Nitro SSR)       <- aus Backend/Dockerfile bzw. Dockerfile.frontend gebaut
   |  HTTP, docker-internes Netz
   v
Backend-Container (ASP.NET Core API)
   |  docker-internes Netz
   v
Postgres-Container (Volume auf dem Host)
```

Sobald eine Domain da ist (Schritt 5B), kommt Caddy als TLS-Terminierung davor:

```
Browser
   |  HTTPS (443)
   v
Caddy-Container (TLS-Terminierung, automatisches Let's Encrypt)
   |  HTTP, docker-internes Netz
   v
Frontend-Container (Node/Nitro SSR)
   |  HTTP, docker-internes Netz
   v
Backend-Container (ASP.NET Core API)
   |  docker-internes Netz
   v
Postgres-Container (Volume auf dem Host)
```

In beiden Fällen gilt: Backend und Postgres hängen nur im docker-internen Netzwerk und sind untereinander
per Servicename erreichbar (`backend`, `frontend`, `postgres`) — sie haben **keine** an den Host gebundenen
Ports und sind von außen nicht ansprechbar. Nur der öffentlich erreichbare Container (Frontend im
No-Domain-Setup, Caddy sobald eine Domain da ist) published einen Port. Wichtig: nie zusätzlich `ports:`
für Backend/Postgres ergänzen — Docker trägt eigene iptables-Regeln ein und kann dabei eine
UFW-„deny"-Regel umgehen, wenn ein Port versehentlich mit `ports:` auf `0.0.0.0` publiziert wird.

## Voraussetzungen

- Zugriff auf das Strato-Kundenpanel (zum Bestellen des Servers und für die DNS-Verwaltung der Domain).
- Der Domain-Ordner/FTP-Zugang vom bisherigen Webhosting-Paket bleibt bestehen, wird für diese Domain aber
  nicht mehr genutzt, sobald die DNS umgestellt ist (Schritt 5B).

Bewusst **kein Plesk** aktivieren, auch wenn es als optionale Lizenz kostenlos dazu buchbar wäre: Docker
braucht ohnehin keine Panel-Verwaltung, und bei kleineren Tarifen (4 GB RAM) frisst Plesk zusätzlich einen
spürbaren Teil des Budgets. Bei VPS L (8 GB RAM) wäre das zwar kein Ressourcenproblem mehr, aber unnötige
zusätzliche Komplexität, die diese Anleitung bewusst vermeidet.

---

## 0. V-Server bei Strato bestellen

- Auf strato.de → „Server" → Linux-V-Server auswählen.
- Tarif mit mindestens **2 vCores / 4 GB RAM / 40 GB NVMe** wählen (reicht für 50 Nutzer/5-10 gleichzeitig
  komfortabel). Der Tarif **VPS L** (6 vCores / 8 GB RAM / 240 GB NVMe) liegt deutlich darüber — für
  Docker-Builds (die kurzzeitig mehr CPU/RAM brauchen als der laufende Betrieb) ist das komfortabel genug
  Luft, Ressourcenprobleme sind damit praktisch ausgeschlossen.
- Als Betriebssystem **Ubuntu 24.04 LTS** auswählen (bei VPS L auch 26.04 LTS verfügbar, Debian und
  Rocky/AlmaLinux als Alternativen — diese Anleitung ist auf 24.04 LTS getestet).
- Rechenzentrums-Standort: Strato betreibt seine Linux-V-Server ausschließlich in zwei
  Hochsicherheitsrechenzentren in Deutschland — auch wenn im Bestellprozess "Europa" statt "Deutschland"
  zur Auswahl stand, landet der Server laut Strato-Produktdaten dort.
- Falls im Bestellprozess abgefragt: eigenen SSH-Public-Key hochladen (spart den Key-Schritt weiter unten) —
  sonst kommt ein root-Passwort per E-Mail/Kundenpanel.
- Bestellung abschließen; IP-Adresse und Zugangsdaten kommen per E-Mail bzw. stehen im Kundenpanel.

(Die genauen Klickpfade im Strato-Bestellprozess können von der aktuellen Panel-Version abweichen — die
Eckdaten oben sind das, worauf es ankommt.)

**Gut zu wissen für den Notfall:** Strato bietet im Kundenpanel eine browserbasierte **VNC-Konsole** —
falls du dich mal per SSH aussperrst (z. B. durch einen Fehler in der Firewall- oder `sshd_config`),
kommst du darüber trotzdem an den Server, ganz ohne SSH. Kein eigenes Desktop-GUI auf dem Server selbst,
nur ein Notzugriff auf die Konsole.

Ebenfalls inklusive: eine optionale Firewall auf Strato-Seite (zusätzlich zur `ufw`-Firewall, die wir
gleich auf dem Server selbst einrichten) und ein SSL-Zertifikat — Letzteres brauchen wir hier nicht, da
Caddy in Schritt 5B automatisch ein eigenes Let's-Encrypt-Zertifikat holt. **Backups sind bei allen
Linux-V-Server-Tarifen nicht inklusive** (siehe Schritt 8).

---

## 1. Server-Grundabsicherung

Als `root` einloggen — du hast deinen Public Key schon bei der (Neu-)Installation der VM bei Strato
hochgeladen, Passwort-Login für `root` ist daher bereits deaktiviert. Deshalb explizit mit `-i` auf den
privaten Schlüssel verweisen (liegt nicht im SSH-Standardpfad):

```bash
ssh -i F:/Strato/SSH/id_ed25519 root@31.70.92.211
apt update && apt upgrade -y
```

Eigenen sudo-User anlegen (nicht dauerhaft als root arbeiten). Bei `adduser` nach einem Unix-Passwort für
`max` gefragt — das ist nur für spätere `sudo`-Abfragen auf dem Server, hat nichts mit SSH-Login zu tun:

```bash
adduser max
usermod -aG sudo max
```

SSH-Key-Login für `max` einrichten: Weil `root` bereits per Key eingeloggt ist, kopierst du seinen
`authorized_keys`-Eintrag einfach direkt auf dem Server zu `max` weiter (kein `ssh-copy-id` von deinem
Windows-Rechner nötig — würde ohnehin an derselben Passwort-Sperre scheitern, die gerade `root` schützt):

```bash
# Noch als root, auf dem Server:
mkdir -p /home/max/.ssh
cp /root/.ssh/authorized_keys /home/max/.ssh/authorized_keys
chown -R max:max /home/max/.ssh
chmod 700 /home/max/.ssh
chmod 600 /home/max/.ssh/authorized_keys
```

Danach in einem **zweiten** Terminal-Fenster (die aktuelle root-Sitzung offen lassen, falls etwas
schiefgeht) testen, ob der Login als `max` per Key klappt:

```bash
ssh strato-vm
```

(Nutzt automatisch `max` + deinen Key, siehe `C:\Users\maxru\.ssh\config`.) Klappt das, in der root-Sitzung
noch `root`-Login komplett sperren und sicherstellen, dass Passwort-Login wirklich aus ist (`sudo nano
/etc/ssh/sshd_config`, folgende zwei Zeilen prüfen/ergänzen):

```
PasswordAuthentication no
PermitRootLogin no
```

```bash
sudo systemctl restart ssh
```

Ab jetzt kannst du dich nur noch als `max` einloggen, mit `ssh strato-vm` statt der langen Form mit IP
und `-i`.

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

Swap-Space anlegen — günstiges Sicherheitsnetz gegen abrupte OOM-Kills bei Lastspitzen (z. B. während des
Docker-Builds, der `dotnet publish` und `npm run build` im Container ausführt):

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Ab hier alle Befehle als `max` mit `sudo`, nicht mehr als root.

---

## 2. Docker installieren

Das ist die einzige Software, die auf dem Server direkt installiert wird — alles andere (.NET, Node,
Postgres) lebt nur in Containern:

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

## 3. Code auf den Server holen

```bash
sudo mkdir -p /opt/teamcompass
sudo chown "$USER" /opt/teamcompass
git clone https://github.com/DerRUbelRollt/Football.git /opt/teamcompass/app
cd /opt/teamcompass/app
```

Das Repo ist öffentlich, daher reicht das normale `git clone` ohne Token/Deploy-Key.

---

## 4. Secrets konfigurieren

```bash
cp .env.docker.example .env.docker
nano .env.docker
```

Ausfüllen (in `nano`: Pfeiltasten zum Navigieren, danach `Strg+O` zum Speichern, `Strg+X` zum Beenden):

- `POSTGRES_PASSWORD`: neues, starkes Passwort — nicht die Dev-Zugangsdaten aus `Backend/appsettings.Development.json`.
- `DOMAIN`: **kannst du vorerst so lassen/leer lassen, du hast noch keine Domain.** Wird erst gebraucht,
  sobald du auf Schritt 5B wechselst (siehe unten).

`.env.docker` bewusst **nicht** einchecken (steht in `.gitignore`) — Berechtigungen einschränken:

```bash
chmod 600 .env.docker
```

---

## 5. Container bauen und starten

Du hast noch keine eigene Domain — deshalb starten wir vorerst **ohne** Caddy/TLS, erreichbar direkt über
die VPS-IP per HTTP. Sobald du später eine Domain hast, wechselst du mit ein paar Befehlen auf HTTPS
(Schritt 5B) — der Rest (Backend, Frontend, Datenbank) bleibt dabei unverändert.

### 5A. Jetzt: ohne Domain, per IP (HTTP)

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.ip.yml up --build -d
```

Das baut Backend- und Frontend-Image direkt aus dem geklonten Repo (dauert beim ersten Mal ein paar
Minuten) und startet danach Postgres, Backend und Frontend. `docker-compose.ip.yml` published nur den
Frontend-Container direkt auf Port 80 der VM — kein Caddy, kein Zertifikat, dafür sofort erreichbar unter:

```
http://31.70.92.211
```

Status prüfen:

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.ip.yml ps
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.ip.yml logs -f
```

(Mit `Strg+C` verlässt du die Log-Ansicht wieder, die Container laufen weiter.)

### 5B. Später: sobald du eine Domain hast (HTTPS via Caddy)

Das passiert **nicht automatisch**, nur weil die Domain registriert ist — du musst diese zwei Teile
einmalig selbst nacheinander ausführen, in genau dieser Reihenfolge:

**Erst DNS umstellen.** Im Strato-Kundenpanel: Domains → `svhrh.team` → DNS-Verwaltung.

- **A-Record** anlegen bzw. ändern: zeigt auf `31.70.92.211`.
- Für `www` ebenfalls einen A-Record (oder CNAME auf die Hauptdomain) anlegen (`www.svhrh.team`).
- DNS-Umstellung kann bis zu 24h propagieren, meist deutlich schneller. Mit
  `nslookup svhrh.team` (auch von deinem Windows-Rechner aus) prüfen, ob schon `31.70.92.211`
  zurückkommt — erst wenn das der Fall ist, macht der nächste Teil Sinn.

**Dann erst auf dem Server umschalten.** Sobald `nslookup svhrh.team` die richtige IP liefert:

```bash
cd /opt/teamcompass/app
nano .env.docker   # DOMAIN=svhrh.team eintragen

docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.ip.yml down
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

`docker-compose.prod.yml` ersetzt die `.ip.yml`-Variante: es fügt den Caddy-Container hinzu, der Port
80/443 öffentlich published und automatisch ein Let's-Encrypt-Zertifikat für `DOMAIN` holt — kein
manuelles Nginx/Certbot-Setup nötig. Ab dann läuft die Seite unter `https://svhrh.team`. Ab diesem Zeitpunkt
in allen weiteren Befehlen (Updates, Backups, Verifizieren) `docker-compose.prod.yml` statt
`docker-compose.ip.yml` verwenden.

---

## 6. Verifizieren

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.ip.yml ps
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.ip.yml logs backend -f
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.ip.yml logs frontend -f
```

Danach im Browser: `http://31.70.92.211` aufrufen, Login-Flow testen. (Sobald du auf Schritt 5B mit Domain
umgestiegen bist, hier `docker-compose.prod.yml` statt `docker-compose.ip.yml` verwenden und `https://svhrh.team`
aufrufen, inkl. Zertifikat-Check am Schloss-Symbol.)

**Reboot-Test**: einmal durchstarten und prüfen, dass wirklich alles automatisch wieder hochkommt
(`restart: unless-stopped` sorgt dafür, dass Docker die Container nach einem Reboot selbst wieder startet,
sofern der Docker-Daemon per systemd `enable`d ist — das macht `get.docker.com` automatisch):

```bash
sudo reboot
# kurz warten, dann erneut per SSH einloggen (ssh strato-vm)
cd /opt/teamcompass/app
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.ip.yml ps
```

**Sofort nach dem ersten Start:** Mit dem automatisch angelegten Default-Trainer einloggen
(`Trainer` / `12345678`, siehe `Backend/Data/DbInitializer.cs`) und **sofort unter „Einstellungen" das
Passwort ändern** (öffentliches Signup gibt es nicht mehr — neue Trainer-Accounts werden ausschließlich von
bereits angemeldeten Trainern über die Einstellungsseite angelegt).

---

## 7. Künftige Updates ausrollen

```bash
cd /opt/teamcompass/app
git pull
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.ip.yml up --build -d
```

(Läuft der Server schon mit Domain/Caddy — Schritt 5B —, dann hier `docker-compose.prod.yml` statt
`docker-compose.ip.yml` verwenden, wie in allen Befehlen ab diesem Zeitpunkt.)

`up --build -d` baut nur die Images neu, deren Quellcode sich seit dem letzten Build geändert hat, und
ersetzt danach nur die betroffenen Container — mit minimaler Downtime. Sessions liegen in-memory (siehe
`Backend/README.md`) — ein Neustart des Backend-Containers loggt alle Trainer aus. Bei 50 Nutzern
unkritisch, aber am besten außerhalb der Hauptnutzungszeit deployen.

Alte, nicht mehr referenzierte Images aufräumen (spart Plattenplatz, bei VPS L auf 240 GB NVMe unkritisch):

```bash
docker image prune -f
```

---

## 8. Backups

Strato-V-Server-Tarife enthalten standardmäßig **keine** automatischen Backups. Minimaler eigener Schutz
für die Datenbank (Dump aus dem laufenden Postgres-Container):

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.ip.yml exec -T postgres \
  pg_dump -U teamcompass teamcompass | gzip > /var/backups/teamcompass-$(date +\%F).sql.gz
```

(Auch hier: sobald mit Domain/Caddy betrieben, `docker-compose.prod.yml` statt `docker-compose.ip.yml`.)

Als Cronjob (z. B. täglich um 3 Uhr) einrichten und die Dumps zusätzlich offsite kopieren (z. B. per
`scp`/`rclone` auf einen anderen Rechner/Cloud-Speicher) — ein Backup, das nur auf demselben Server liegt,
schützt nicht vor Server-Totalausfall. Das Postgres-Datenverzeichnis selbst liegt im benannten Volume
`postgres-data` und übersteht Container-Neustarts/-Updates unverändert.

---

## Bekannte Einschränkungen (bewusst nicht in diesem Schritt behoben)

- **Noch kein TLS (Schritt 5A, solange keine Domain vorhanden ist)**: Die Seite läuft aktuell nur über
  `http://31.70.92.211` — Login-Passwort und Session-Cookie reisen dabei unverschlüsselt über das
  öffentliche Internet. Für einen kurzen Testzeitraum vertretbar, aber sobald echte Trainer/Spielerdaten
  eingegeben werden, sollte zügig eine Domain besorgt und auf Schritt 5B (Caddy/HTTPS) umgestiegen werden.
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
- **Kein CI/CD**: Updates laufen aktuell manuell nach Schritt 7 (`git pull` + `up --build -d` direkt auf dem
  Server). Ließe sich später per GitHub Actions automatisieren.
- **Keine automatischen OS-Sicherheitsupdates**: `sudo apt install unattended-upgrades` wäre ein sinnvoller
  zusätzlicher Härtungsschritt für den Host selbst (unabhängig von Docker).
- **Build läuft auf dem Produktivserver**: `docker compose up --build` baut Backend/Frontend direkt auf der
  VM, das beansprucht während des Deploys kurzzeitig CPU/RAM. Bei 4-8 GB RAM unproblematisch, aber bewusst
  außerhalb der Hauptnutzungszeit deployen.
