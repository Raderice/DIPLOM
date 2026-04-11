# Real-Time Board Games Monorepo

Production-ready monorepo for a low-resource real-time browser platform with Chess, Russian Checkers, and Durak.

## Stack

- Frontend: React 19, TypeScript, Vite 5, Tailwind CSS, shadcn/ui-style components, Zustand, React Router v7, Socket.IO client v4, react-chessboard, chess.js, Konva/react-konva
- Backend: Node.js LTS, Express, TypeScript, Prisma ORM, PostgreSQL (SQLite fallback), Socket.IO v4, JWT auth via httpOnly cookies + refresh tokens
- Infra: Docker Compose, Nginx reverse proxy, optional Redis profile off by default

## Monorepo Layout

- `packages/shared`: shared TypeScript contracts for states and socket events
- `packages/backend`: API, auth, room management, real-time authoritative game engine
- `packages/frontend`: SPA client with lobby, room flow, game boards, admin page

## Environment

For a quick Docker start (one command), `.env` is optional because compose has defaults.

If you want custom secrets/origins, copy `.env.example` to `.env` and update values:

```bash
cp .env.example .env
```

### Variables

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | optional | Runtime mode (`development` or `production`) |
| `PORT` | optional | Backend port |
| `CLIENT_ORIGIN` | optional | Allowed frontend origin(s), comma separated |
| `DATABASE_PROVIDER` | optional | `postgresql` or `sqlite` |
| `DATABASE_URL` | optional | Prisma connection string |
| `JWT_ACCESS_SECRET` | optional | Access token secret |
| `JWT_REFRESH_SECRET` | optional | Refresh token secret |
| `ACCESS_TOKEN_TTL_MIN` | optional | Access token TTL (minutes) |
| `REFRESH_TOKEN_TTL_DAYS` | optional | Refresh token TTL (days) |
| `POSTGRES_DB` | docker | Postgres DB name |
| `POSTGRES_USER` | docker | Postgres user |
| `POSTGRES_PASSWORD` | docker | Postgres password |
| `VITE_API_URL` | frontend | Frontend API URL |

## Local Development

1. Install dependencies from root.
2. Run Prisma generate + migrations.
3. Start backend and frontend.

```bash
npm install
npm run build -w @board-games/shared

npm run prisma:generate -w @board-games/backend
npm run prisma:dev -w @board-games/backend
npm run prisma:seed -w @board-games/backend

npm run dev
```

Backend: `http://localhost:4000`

Frontend: `http://localhost:5173`

## Home Server Guide (White IP, Global Access)

This section is a full end-to-end path for running the platform from your own home server and letting players connect from anywhere.

The guide assumes:

- You have a white public IPv4 from your ISP
- You can configure router/NAT/firewall rules
- You use Ubuntu Server 24.04 LTS (recommended)

### 1. Infrastructure Plan

Use this topology:

- Home server runs Docker stack (Postgres + backend + frontend + nginx)
- Domain points to your white IP (for example `games.your-domain.com`)
- Reverse proxy serves HTTPS and forwards traffic to app

Minimum recommended hardware:

- CPU: 2 cores
- RAM: 4 GB (8 GB recommended)
- Disk: 25 GB SSD
- Stable wired internet if possible

### 2. Install Operating System

1. Download Ubuntu Server 24.04 LTS ISO.
2. Create bootable USB and install system.
3. During install:
	- create non-root admin user (example: `boardgames`)
	- enable OpenSSH server
	- set static LAN IP (or DHCP reservation in router)
4. Reboot and login via SSH.

### 3. Initial Hardening

Run on server:

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install curl git ufw fail2ban ca-certificates gnupg lsb-release

sudo timedatectl set-timezone UTC

# Firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

Optional but strongly recommended:

- SSH key auth only (disable password auth in `/etc/ssh/sshd_config`)
- Disable root SSH login
- Change SSH port if you need additional hardening

### 4. Install Docker + Compose Plugin

```bash
# Docker repository
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo systemctl enable docker
sudo systemctl start docker

# allow current user to run docker without sudo
sudo usermod -aG docker $USER
newgrp docker
```

### 5. Domain + DNS

1. Buy/use domain (for example `your-domain.com`).
2. Create `A` record:
	- host: `games`
	- value: your white public IP
	- TTL: 300
3. Wait DNS propagation and verify:

```bash
dig +short games.your-domain.com
```

It must return your current public IP.

### 6. Clone Project and Prepare Environment

```bash
cd /opt
sudo mkdir -p board-games
sudo chown -R $USER:$USER board-games
cd board-games

git clone <YOUR_REPO_URL> project
cd project
cp .env.example .env
```

Open `.env` and configure production values:

```env
NODE_ENV=production
PORT=4000

# IMPORTANT: your public HTTPS origin
CLIENT_ORIGIN=https://games.your-domain.com
VITE_API_URL=https://games.your-domain.com

DATABASE_PROVIDER=postgresql
POSTGRES_DB=boardgames
POSTGRES_USER=boardgames
POSTGRES_PASSWORD=<very_strong_password>

JWT_ACCESS_SECRET=<long_random_string>
JWT_REFRESH_SECRET=<different_long_random_string>
ACCESS_TOKEN_TTL_MIN=15
REFRESH_TOKEN_TTL_DAYS=7
```

Generate strong secrets:

```bash
openssl rand -hex 64
openssl rand -hex 64
```

### 7. Start Stack and Initialize Database

```bash
cd /opt/board-games/project
docker compose up -d --build
```

Run schema deployment and seed demo users:

```bash
docker compose exec backend npx prisma db push --schema packages/backend/prisma/schema.prisma
docker compose exec backend npm run prisma:seed -w @board-games/backend
```

Check containers:

```bash
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 nginx
```

### 8. Enable HTTPS (Mandatory for Public Internet)

For global play you should use HTTPS. Easiest path: host-level Nginx + Certbot, app stays behind local port 80.

1. Keep Docker app on server (nginx container already listens on `:80`).
2. Install Certbot on host:

```bash
sudo apt -y install certbot
```

3. Stop containers for first certificate request:

```bash
cd /opt/board-games/project
docker compose down
sudo certbot certonly --standalone -d games.your-domain.com
```

4. Start containers again:

```bash
docker compose up -d
```

5. Configure your edge reverse proxy (host Nginx/Caddy/Traefik) to terminate TLS and proxy to `http://127.0.0.1:80`.

If you prefer Cloudflare, use Full (strict) TLS mode and still keep valid origin certificate on server.

### 9. Router and Network Setup

If server is behind home router NAT:

1. Forward TCP `80` and `443` from router WAN to server LAN IP.
2. Reserve static DHCP lease for server.
3. Disable UPnP if possible.
4. Keep router firmware updated.

If your server is directly on public network with white IP, configure host firewall rules carefully and expose only `80/443`.

### 10. Verify from External Network

Use mobile internet (not your home Wi-Fi) and test:

- `https://games.your-domain.com` loads frontend
- Registration/login works
- Create room and join from second remote device
- Real-time events work: ready/start/moves/chat/reconnect

Quick checks from server:

```bash
curl -I https://games.your-domain.com
curl -s https://games.your-domain.com/api/health
```

### 11. Run and Update Operations

Useful commands:

```bash
# Update app
cd /opt/board-games/project
git pull
docker compose up -d --build

# Logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx

# Restart
docker compose restart

# Stop
docker compose down
```

### 12. Backups and Recovery

Backup Postgres volume daily:

```bash
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup_$(date +%F).sql
```

Also backup:

- `.env`
- your reverse proxy TLS config
- repository revision/tag currently deployed

### 13. Security Checklist for Global Public Access

- Use unique strong passwords and JWT secrets
- HTTPS only (do not serve login over plain HTTP)
- Keep OS and Docker images updated
- Expose only required ports
- Monitor logs for suspicious traffic
- Rotate secrets after incidents

### 14. Performance and Stability Notes

- Run exactly one backend and one frontend instance unless you intentionally scale
- Keep container restart policy `unless-stopped`
- For many rooms, add monitoring and move to VPS/hosted DB if home uplink becomes bottleneck
- Prefer Ethernet and stable router QoS for low latency gameplay

### 15. Global Match Smoke Test

Before inviting players worldwide, run this final checklist:

1. User A (country/city A) creates room.
2. User B (country/city B) joins by invite code.
3. Start each game type: chess, checkers, durak.
4. Verify click and drag controls in all games.
5. Simulate reconnect (disable internet for 10-15 seconds), ensure player returns without room corruption.
6. Complete one match in each game and verify game-over flow.

## Test Accounts

After running `npm run prisma:seed -w @board-games/backend`, the following test users are available:

- User: `demo@example.com` / `DemoUser123!`
- Admin: `admin@example.com` / `AdminUser123!`

These can be overridden with env variables:

- `TEST_USER_USERNAME`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`
- `TEST_ADMIN_USERNAME`, `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`

The login page also exposes quick-fill presets via:

- `VITE_TEST_USER_EMAIL`, `VITE_TEST_USER_PASSWORD`
- `VITE_TEST_ADMIN_EMAIL`, `VITE_TEST_ADMIN_PASSWORD`

## Docker Run

### One Command On Server

If you cloned the project on a server and want to run everything with one command:

```bash
docker compose up -d --build
```

Then open:

- `http://192.168.31.255`

Notes:

- Base `docker-compose.yml` is now production-oriented and can start without manual `.env` creation.
- Backend auto-runs Prisma generate + db push on startup, so DB schema is initialized automatically.
- If your server IP is different, override origin before start:

```bash
CLIENT_ORIGIN="http://YOUR_SERVER_IP" VITE_API_URL="http://YOUR_SERVER_IP" docker compose up -d --build
```

### Standard Docker Run

```bash
docker compose up --build
```

Services:

- `nginx` on `http://localhost`
- `backend` internal `:4000`
- `frontend` internal `:4173`
- `postgres` internal `:5432`
- `redis` available only when profile is enabled

Enable Redis profile:

```bash
docker compose --profile redis up --build
```

### Development Compose Profile

Development overrides were moved to `docker-compose.dev.yml`.

Use this for local hot-reload dev via Docker:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Prisma Migrations

Included migration SQL:

- `packages/backend/prisma/migrations/202604100001_init/migration.sql`

## Auth Flow

- Register/Login create `access_token` (15m) + `refresh_token` (7d) as httpOnly cookies
- Refresh endpoint rotates refresh token and updates cookies
- Socket.IO handshake validates `access_token` cookie

## Realtime Events

Typed in shared package:

- `room:join`, `room:leave`, `room:ready`, `room:start`
- `game:move`, `game:state`, `game:over`
- `chat:message`
- `player:disconnected`, `player:reconnected`

## RAM Budget Notes

- Redis is disabled by default to reduce idle memory usage
- Active rooms are stored in in-memory `Map<roomId, GameState>`
- Chat history is capped to last 50 messages per room
- Frontend uses route-level pages and light UI dependencies

## Security Notes

- Use strong random JWT secrets in production
- Keep cookies `httpOnly`; in production run behind HTTPS (`secure` cookies)
- Never commit `.env`

## License

MIT
