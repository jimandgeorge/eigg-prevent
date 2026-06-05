# Deploying EIGG Prevent to a DigitalOcean droplet (prevent.eigg.io)

Single droplet, single `docker-compose.prod.yml`: Postgres + FastAPI backend +
Next.js frontend + nginx (TLS). nginx routes `/api/v1/*` and `/health` to the
backend; everything else (pages, NextAuth `/api/auth`, admin proxy `/api/admin`,
`/invite`, `/admin`) to the frontend.

## 1. DNS
Point an **A record** `prevent.eigg.io` → the droplet's IPv4.

## 2. Droplet prep
```bash
# Ubuntu droplet, as root or a sudo user
apt-get update && apt-get install -y docker.io docker-compose-plugin certbot
git clone <this repo> eigg-prevent && cd eigg-prevent
cp .env.prod.example .env
# Edit .env — set strong POSTGRES_PASSWORD, NEXTAUTH_SECRET (openssl rand -base64 32),
# INTERNAL_API_SECRET (openssl rand -hex 32), ADMIN_PASSWORD, and DATABASE_URL to match
# the db password. Add ANTHROPIC_API_KEY / RESEND_API_KEY if using real AI / email.
```

## 3. TLS certificate (one-time)
```bash
# Get the cert before first nginx start (webroot needs the dir to exist).
mkdir -p /var/www/certbot
certbot certonly --standalone -d prevent.eigg.io   # stop anything on :80 first
# Renewal (cron/systemd timer): certbot renew --quiet && docker compose -f docker-compose.prod.yml restart nginx
```
The compose mounts `/etc/letsencrypt` read-only into nginx.

## 4. Build & run
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
On boot the backend runs the idempotent seed (pillars/requirements/controls + tables)
and seeds the platform admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

## 5. First sign-in
- Go to `https://prevent.eigg.io/login`, sign in with the **admin email** (must contain `@`)
  and `ADMIN_PASSWORD`.
- Visit `/admin` to create the first customer workspace + admin invite.
- A brand-new workspace lands on the onboarding wizard.

## Notes
- `NEXT_PUBLIC_API_URL` is **baked at image build** — keep it empty for same-origin.
  If you change it, rebuild the frontend image.
- Persisted volumes: `pgdata` (database) and `uploads` (evidence files).
- Email is stubbed (invite link logged) until `RESEND_API_KEY` is set and `eigg.io`
  is verified in Resend.
- To rotate the admin password, change `ADMIN_PASSWORD` and recreate the backend, or
  manage users via `/admin`.
