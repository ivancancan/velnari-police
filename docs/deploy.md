# Velnari — Deployment Guide

## Architecture

| Layer | Service | Tier |
|-------|---------|------|
| Web (Next.js) | Vercel | Hobby (free) |
| API (NestJS) | Railway | Starter ($5/mo credit) |
| Database (PostgreSQL + PostGIS) | Supabase | Free (500 MB) |
| Redis | Upstash | Free (10K req/day) |

---

## Step 1: Database (Supabase)

1. Create account at [supabase.com](https://supabase.com)
2. New project — Region: US East (or closest to your users)
3. Go to **SQL Editor** and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
4. Copy the connection string from **Settings > Database > Connection string (URI)**
5. Run migrations and seed from your local machine:
   ```bash
   DATABASE_URL="postgresql://postgres:<password>@<host>:5432/postgres" pnpm --filter api db:migrate
   DATABASE_URL="postgresql://postgres:<password>@<host>:5432/postgres" pnpm --filter api db:seed
   ```

---

## Step 2: Redis (Upstash)

1. Create account at [upstash.com](https://upstash.com)
2. Create a Redis database — Region: US East
3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (or host/port/password for ioredis)

---

## Step 3: API (Railway)

1. Create account at [railway.app](https://railway.app)
2. New project — **Deploy from GitHub repo**
3. Railway will detect `railway.toml` at the repo root and use the Dockerfile at `apps/api/Dockerfile`
4. Add environment variables:
   ```
   NODE_ENV=production
   PORT=3001
   DB_HOST=<supabase-host>
   DB_PORT=5432
   DB_USER=postgres
   DB_PASS=<supabase-password>
   DB_NAME=postgres
   REDIS_HOST=<upstash-host>
   REDIS_PORT=<upstash-port>
   REDIS_PASSWORD=<upstash-password>
   JWT_SECRET=<generate-32-char-secret>
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_SECRET=<generate-another-secret>
   JWT_REFRESH_EXPIRES_IN=7d
   SENTRY_DSN=<optional>
   ALLOWED_ORIGINS=https://your-app.vercel.app
   ```
5. Railway will build and deploy automatically
6. Note the generated URL (e.g., `velnari-api.up.railway.app`)

---

## Step 4: Web (Vercel)

1. Create account at [vercel.com](https://vercel.com)
2. Import GitHub repo
3. Vercel will detect `vercel.json` at the repo root with `rootDirectory: apps/web`
4. Framework will be auto-detected as **Next.js**
5. Add environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://velnari-api.up.railway.app/api
   NEXT_PUBLIC_WS_URL=https://velnari-api.up.railway.app
   NEXT_PUBLIC_SENTRY_DSN=<optional>
   ```
6. Deploy

> **Note:** Because Next.js has `transpilePackages: ['@velnari/shared-types']` in `next.config.mjs`, the shared types package is compiled as part of the Next.js build. The `vercel.json` build command also runs `pnpm --filter @velnari/shared-types build` first as a safety net.

---

## Step 5: Custom Domain (optional)

### Vercel
1. Project Settings > Domains
2. Add `demo.velnari.mx`
3. Add DNS CNAME record: `demo` -> `cname.vercel-dns.com`

### Railway
1. Service Settings > Domains
2. Add `api.velnari.mx`
3. Add DNS CNAME record as instructed by Railway

---

## Verify

```bash
# Health check
curl https://velnari-api.up.railway.app/api/health

# Login
curl -X POST https://velnari-api.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@velnari.mx","password":"Velnari2024!"}'
```

---

## Estimated Monthly Cost

| Service | Tier | Cost |
|---------|------|------|
| Vercel | Hobby | $0 |
| Railway | Starter | $0 (first $5 free) |
| Supabase | Free | $0 (500 MB) |
| Upstash | Free | $0 (10K req/day) |
| **Total** | | **$0/month** |

---

## Scaling (when needed)

| Service | Pro Tier | Cost |
|---------|----------|------|
| Vercel Pro | More builds, analytics | $20/mo |
| Railway Pro | More compute, memory | $20/mo |
| Supabase Pro | 8 GB, daily backups | $25/mo |
| **OR** AWS ECS | Full control | ~$80-150/mo |
