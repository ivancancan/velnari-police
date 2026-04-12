# Velnari — GitHub Secrets & Platform Config Checklist

> **How to add GitHub secrets:**  
> Repository → Settings → Secrets and variables → Actions → New repository secret

---

## 1. GitHub Actions Secrets

### 1a. Production CI (`ci.yml` — `migrate` job)

These run on every push to `main` and execute the database migration against production.

| Secret name | Description | Example / how to generate |
|-------------|-------------|---------------------------|
| `DB_HOST` | Production PostgreSQL host | `db.railway.internal` or RDS endpoint |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | Database user | `velnari` |
| `DB_PASSWORD` | Database password | Generate: `openssl rand -base64 32` |
| `DB_NAME` | Database name | `velnari_prod` |
| `JWT_SECRET` | JWT signing secret | Generate: `openssl rand -base64 64` |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | Generate: `openssl rand -base64 64` |

### 1b. Staging CI (`staging.yml` — all jobs)

These run on every push to the `staging` branch.

| Secret name | Description | Example / how to generate |
|-------------|-------------|---------------------------|
| `STAGING_DB_HOST` | Staging PostgreSQL host | |
| `STAGING_DB_PORT` | Staging PostgreSQL port | `5432` |
| `STAGING_DB_USER` | Staging DB user | `velnari_staging` |
| `STAGING_DB_PASS` | Staging DB password | Generate: `openssl rand -base64 32` |
| `STAGING_DB_NAME` | Staging database name | `velnari_staging` |
| `STAGING_JWT_SECRET` | JWT signing secret for staging | Generate: `openssl rand -base64 64` |
| `STAGING_JWT_REFRESH_SECRET` | Refresh token secret for staging | Generate: `openssl rand -base64 64` |
| `STAGING_ALLOWED_ORIGINS` | Comma-separated allowed CORS origins | `https://staging.velnari.mx` |
| `STAGING_REDIS_HOST` | Redis host for staging | |
| `STAGING_URL` | Staging API base URL (used in smoke test) | `https://api-staging.velnari.mx` |
| `STAGING_DEPLOY_HOOK` | Railway/Render/etc. deploy webhook URL | Obtain from platform dashboard |
| `STAGING_API_URL` | Staging API URL for smoke test health check | `https://api-staging.velnari.mx/api` |

---

## 2. Railway (Production API)

Set these in Railway → Project → velnari-api → Variables:

```
NODE_ENV=production
PORT=3001

# Database (Railway provides these automatically for linked Postgres)
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_NAME=${{Postgres.PGDATABASE}}

# Redis (Railway provides these automatically for linked Redis)
REDIS_HOST=${{Redis.REDISHOST}}
REDIS_PORT=${{Redis.REDISPORT}}
REDIS_PASSWORD=${{Redis.REDISPASSWORD}}

# Auth
JWT_SECRET=<generate: openssl rand -base64 64>
JWT_REFRESH_SECRET=<generate: openssl rand -base64 64>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Security
ALLOWED_ORIGINS=https://app.velnari.mx,https://velnari.mx

# Observability
SENTRY_DSN=<from Sentry project settings>
GIT_SHA=<set automatically by CI>

# Storage (S3 / Railway Volume)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<from AWS IAM>
AWS_SECRET_ACCESS_KEY=<from AWS IAM>
AWS_S3_BUCKET=velnari-prod-attachments

# Optional: enable Swagger in non-prod only (leave unset in prod)
# SWAGGER_ENABLED=true
```

---

## 3. Vercel (Production Web)

Set these in Vercel → Project → velnari-web → Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL=https://api.velnari.mx/api
NEXT_PUBLIC_WS_URL=https://api.velnari.mx
NEXT_PUBLIC_SENTRY_DSN=<from Sentry project settings — frontend project>

# Set automatically by Vercel in most setups; otherwise set manually:
NEXT_PUBLIC_GIT_SHA=<set by CI via vercel env pull or --build-env>
```

---

## 4. Secrets that must NOT be committed

| Item | Where it lives instead |
|------|------------------------|
| `.env` files with real values | Developer machines only; `.gitignore`d |
| JWT secrets | GitHub Secrets + Railway/Vercel env vars |
| DB credentials | GitHub Secrets + Railway managed variables |
| AWS IAM keys | GitHub Secrets + Railway env vars |
| Sentry DSN | GitHub Secrets + Railway/Vercel env vars |
| Deploy hook URLs | GitHub Secrets |
| Admin passwords | 1Password / Bitwarden |

---

## 5. Rotation policy

| Secret type | Recommended rotation |
|-------------|---------------------|
| JWT secrets | Every 90 days, or immediately after any suspected leak |
| DB passwords | Every 90 days |
| AWS IAM keys | Every 90 days; use IAM roles instead where possible |
| Sentry DSN | Only on team member offboarding |
| Deploy hooks | On team member offboarding |

**After rotating a secret:**
1. Update the secret in GitHub → Settings → Secrets
2. Update the secret in Railway / Vercel
3. Re-deploy the affected service immediately
4. Verify health endpoints respond correctly
5. Note the rotation in the incident log or commit message

---

## 6. Quick validation

After setting all secrets, verify the staging pipeline end-to-end:

```bash
# Trigger staging workflow manually
gh workflow run staging.yml --ref staging

# Watch the run
gh run watch
```

Then verify production by checking the health endpoint after a `main` merge:

```bash
curl https://api.velnari.mx/api/health
# Expected: {"status":"ok"} or similar
```
