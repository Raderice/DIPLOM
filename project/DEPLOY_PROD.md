# Production Deployment Guide

This document describes steps to prepare and deploy the project to a production server using Docker Compose and Nginx. It also lists basic checks and responsive audit suggestions.

## Prerequisites

- A Linux host (Ubuntu/Debian recommended) with Docker and Docker Compose v2 installed.
- A domain name pointed to the server IP.
- Ports 80 (HTTP) and 443 (HTTPS) open on the server.
- Environment variables / secrets prepared (see `.env.production.example`).

## Prepare repository on server

1. Clone the repository on the server:

```bash
git clone <your-repo-url> project
cd project
```

2. Copy production env sample and edit values:

```bash
cp .env.production.example .env.production
# Edit .env.production - set DB password, CLIENT_ORIGIN, JWT secrets
```

3. Make sure the `uploads` directory exists and is writable:

```bash
mkdir -p uploads
chown 1000:1000 uploads || true
chmod 755 uploads
```

## Build and run with Docker Compose

Build and start services:

```bash
# build images and start detached
docker compose up --build -d
```

Notes:
- The compose file will build `frontend` and `backend` images using provided Dockerfiles.
- Backend will run Prisma generate and `prisma db push` at container start when needed.

## Nginx & TLS

The `nginx/nginx.conf` is configured to:
- Proxy `/api/*`, `/socket.io/`, `/realtime/`, and `/uploads/` to backend.
- Proxy site root to the frontend preview server.

For production TLS (Let’s Encrypt) use `certbot` or place a reverse proxy in front (Caddy). Example with Certbot and nginx:

```bash
# Install certbot + nginx plugin
sudo apt update && sudo apt install -y certbot python3-certbot-nginx
# Obtain certificate (replace example.com)
sudo certbot --nginx -d example.com -d www.example.com
# Certbot will update nginx config; ensure proxy locations remain functional
```

Alternatively, use a managed load balancer or CDN.

## Persistent uploads

The compose file mounts `./uploads` to the backend container at `/repo/uploads`. This keeps user avatars persistent across container restarts. Nginx proxies `/uploads/` to the backend so avatars are accessible via `https://your-domain/uploads/<file>`.

## Healthchecks & Monitoring

- `GET /health` proxied to backend returns basic status.
- Use `docker compose ps` and `docker compose logs -f` to inspect services.
- Add monitoring (Prometheus/node_exporter) if needed.

## Smoke tests (quick checks)

Replace `example.com` with your domain.

```bash
# Health
curl -I https://example.com/health

# API quick ping
curl -i https://example.com/api/auth/health || true

# Frontend
curl -I https://example.com/
```

## Responsive / adaptation audit

Manual checks to run on the server or locally after deployment:

- Open the site on desktop, tablet and mobile viewport sizes (use browser devtools).
- Test all pages: Lobby, Room, Game, Profile, Login/Register.
- Verify avatar upload and that avatar URL resolves via `https://your-domain/uploads/...`.
- Scan QR from Room (open camera on phone or QR app) and ensure it opens `https://your-domain/join/<code>` and joins the room.

Automated suggestions:
- Add Playwright tests to cover registration, create room, join, rematch, avatar upload, QR flow.

## Recommended follow-ups

- Store avatars in object storage (S3) for scalability and backup; change backend to upload to S3.
- Run Prisma migrations (`prisma migrate deploy`) during deployment if you maintain migration files.
- Add CI pipeline to build images and run Playwright smoke tests on PRs.
- Configure HTTP security headers and rate limiting in Nginx.

## Rollback

To rollback to previous images, tag images in your registry and update compose to use specific tags or keep previous image cached on host and re-run `docker compose up -d`.

---

If you want, I can now:

- A) Add Playwright e2e tests and a `npm run e2e` script and run them locally, or
- B) Implement S3 avatar storage and update backend/frontend flow, or
- C) Configure Let's Encrypt automation (Certbot) example and systemd unit for `docker compose`.

Choose A, B or C and I'll proceed.  
