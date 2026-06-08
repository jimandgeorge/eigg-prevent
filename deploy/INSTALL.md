# Install EIGG Prevent (self-hosted)

Run EIGG Prevent on your own infrastructure from the published images — no source
checkout, no build. Everything (database included) runs in Docker. Your data never
leaves your servers.

## Requirements
- A Linux host with **Docker** + the Docker Compose plugin.
- ~2 GB RAM, a few GB disk.
- Access to pull the images from GitHub Container Registry (see "Access" below).

## 1. Get these files
Copy this `deploy/` folder to your host (`docker-compose.yml`, `nginx.conf`,
`.env.example`). Then:
```bash
cp .env.example .env
```

## 2. Configure `.env`
Set at minimum:
- `PUBLIC_URL` — where users reach it (e.g. `http://eigg.yourco.internal` or your https URL).
- `DB_PASSWORD`, `NEXTAUTH_SECRET` (`openssl rand -base64 32`), `INTERNAL_API_SECRET` (`openssl rand -hex 32`).
- `ADMIN_EMAIL` + `ADMIN_PASSWORD` — your first login.
- `LLM_PROVIDER` — `mock` to start, or `ollama` for fully on-prem AI, or `anthropic` with a key.

## 3. Access to the images
If the packages are private, log in once with a token your EIGG contact provides:
```bash
echo <TOKEN> | docker login ghcr.io -u <your-github-username> --password-stdin
```
(If they're public, skip this.)

## 4. Start
```bash
docker compose pull
docker compose up -d
docker compose ps        # all services running
```
The backend initialises its database (framework + tables) and seeds your admin on first boot.

## 5. Sign in
Open `PUBLIC_URL`, go to `/login`, sign in with your **`ADMIN_EMAIL`** (the email, with the
`@`) and `ADMIN_PASSWORD`, then visit **`/admin`** to create workspaces and invite users.

## TLS
The bundled nginx serves HTTP on port 80. For HTTPS either:
- put EIGG behind your existing reverse proxy / load balancer (terminate TLS there), or
- uncomment the 443 block in `nginx.conf`, drop your cert in `./certs/{fullchain,privkey}.pem`,
  and uncomment the `443` port + `./certs` mount in `docker-compose.yml`.

## Update
```bash
docker compose pull && docker compose up -d
```
Pin `IMAGE_TAG=v1.x.x` in `.env` for reproducible installs instead of `latest`.

## Backups
Persisted in Docker volumes: `pgdata` (database) and `uploads` (evidence files). Back these up.
