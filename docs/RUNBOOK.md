# Velnari Runbook

Operational guide for production deploys, incidents, and on-call. Keep this
file living — every post-mortem updates it.

---

## 1. On-call & escalation

| Tier | Person | Channel | When |
|------|--------|---------|------|
| L1 | Ivan | WhatsApp + phone | All SEV-1 / SEV-2 |
| L2 | (TBD — second engineer) | WhatsApp | If L1 unreachable in 15 min |
| Customer escalation | Director Operativo del municipio | Phone (per contract) | Production-impacting outage during turno |

**Bus factor today: 1.** Hire / contract a second on-call before the second pilot.

---

## 2. Pre-deploy checklist

Run before every production deploy:

- [ ] All CI checks green (type-check + tests + Trivy)
- [ ] Migrations reviewed: any destructive changes? Backup taken?
- [ ] `git diff origin/main..HEAD --stat` — does the diff match the changelog?
- [ ] Sentry release marker created (auto via Dockerfile `GIT_SHA` arg)
- [ ] Smoke test on staging if migration touches `incidents`, `units`, `auth`, or `audit_logs`
- [ ] Notify operadores in WhatsApp group if maintenance window expected

---

## 3. Deploy

### API (Railway)

```bash
# Trigger deploy via GitHub Actions (push to main) OR Railway dashboard.
# Migrations run automatically as part of the build (Railway runs `pnpm db:migrate`).
```

**Verify after deploy:**

```bash
curl https://api.velnari.mx/api/health | jq
# Expected: { "status": "ok", "db": "ok", "redis": "ok", "gitSha": "<your sha>" }
```

If `redis` shows `degraded`: app still works (in-memory fallback), but
investigate Redis Cloud dashboard.

If `db` shows `down`: API will return 503. Check Supabase status, connection
string, and pool exhaustion in Railway logs.

### Web (Vercel)

Auto-deploy from `main`. Confirm preview build before promoting.

### Mobile (EAS)

```bash
cd apps/mobile
eas build --platform ios --profile production --auto-submit
# Approve in App Store Connect → TestFlight (1 day) → release
```

---

## 4. Rollback

### API

```bash
# Railway: dashboard → deployments → click previous successful → Redeploy
# OR via CLI:
railway rollback
```

If migration was destructive, **restore DB from Supabase backup first** before
rolling back code (otherwise old code reads from a new schema).

### Web

```bash
vercel rollback
```

### Mobile

Cannot be rolled back from the App Store. Push a hotfix build with `eas update`
(JS-only) within minutes for non-native bugs, or submit a new build for native.

---

## 5. Common failure playbooks

### 5.1 API returns 500 on every request after deploy

1. Check Sentry for the new error spike (releases tab → latest release).
2. Check Railway logs — look for `Cannot find module`, `JWT_SECRET is required`.
3. If env-var missing: add it in Railway, redeploy.
4. If schema mismatch: rollback or run the migration manually.

### 5.2 Redis goes down (`/api/health` shows `redis: degraded`)

App stays up. Token blacklist + login-fail counter use in-memory fallback for
the duration. Implications:

- Logged-out tokens stay blocked on the same pod, but a NEW pod (autoscale)
  won't have the in-memory blacklist. **If pod restart happens during outage,
  blacklisted tokens become valid again until they naturally expire.**
- Login lockout still works per-pod.

**Action:** restore Redis ASAP. Don't redeploy or scale the API during the
outage if possible.

### 5.3 Refresh-token replay alert in Sentry

`Refresh token replay detected for user=<id>. Revoking all sessions.` —
this means a refresh token was used twice. Either:

- The user's device was compromised (force re-login is automatic).
- The mobile app accidentally sent the same refresh twice (race condition).

**Action:** If multiple users, investigate the second case (review
`/api/auth/refresh` logs + mobile network logs). If a single user, contact
them — they may need to re-login on all devices.

### 5.4 GPS not updating from a unit

1. Confirm officer's app is in foreground or has background-location permission.
2. Check `/api/units/:id/history?from=...&to=...` — last point timestamp.
3. If stale: ask officer to toggle "Iniciar rastreo" off/on.
4. iOS: confirm "Always" location permission, not just "While Using".

### 5.5 Database slow / queries timing out

1. Supabase dashboard → Performance → identify slow queries.
2. `/api/health` should still return 200 (timeout is per-query, not per-pool).
3. Likely culprit: missing index after migration, or N+1 in a new endpoint.

---

## 6. Emergency: full outage

If both API and web are down:

1. Notify the municipio via the agreed escalation channel within 5 min.
2. Status page (TODO: set up `status.velnari.mx` via UptimeRobot Pro).
3. Officers fall back to **radio**. The mobile app's offline queue keeps any
   incidents they file locally and replays on reconnect.
4. Rollback BEFORE digging deep — recover service first, root-cause second.

---

## 7. Secrets rotation

Rotate every 90 days, or immediately on suspected compromise:

- `JWT_SECRET` — Railway env. Rotation invalidates ALL access tokens (15min).
- `JWT_REFRESH_SECRET` — Railway env. Rotation invalidates ALL refresh tokens
  (forces all users to re-login).
- `DB_PASS` / Supabase service role — Supabase dashboard + Railway env.
- AWS S3 keys — AWS IAM console + Railway env.
- Sentry DSN — Sentry settings (low risk; rotate on team membership change).

**Rotation procedure for JWT secrets (zero-downtime not required for pilot):**

```bash
# 1. Generate new secrets
openssl rand -base64 64  # use for JWT_SECRET
openssl rand -base64 64  # use for JWT_REFRESH_SECRET

# 2. Update Railway env
# 3. Trigger redeploy
# 4. All users will be force-logged-out within 15 min (access expiry) or
#    on next refresh attempt. Send a heads-up to operadores.
```

---

## 8. Backup & restore

### Database

- Supabase Pro: nightly automated backups, 7-day retention.
- Manual snapshot before any destructive migration.

### S3 / attachments

- Versioning: enable on the bucket (TODO if not already).
- Lifecycle: incidents older than 5 years moved to Glacier.

### Restore drill

Run quarterly:
1. Spin up a scratch Supabase project.
2. Restore yesterday's backup.
3. Boot a local API pointed at it.
4. Verify last 24h of incidents are present.
5. Document time-to-restore (target: < 1h).

---

## 9. Known issues / tech debt

| ID | Issue | Severity | Tracked |
|----|-------|----------|---------|
| 001 | Service-layer specs (incidents, units, dispatch, attachments) need Testcontainers rewrite | High | docs/SECURITY_TODO.md |
| 002 | E2E spec uses pre-PostGIS schema (`lat`/`lng` columns) | High | docs/SECURITY_TODO.md |
| 003 | Refresh-token revocation is per-token, not per-user-family (replay only kills the one chain) | Medium | This file §5.3 |
| 004 | No status page yet | Medium | UptimeRobot Pro pending |
| 005 | Tenant isolation is per-findOne, not query-subscriber. Single-municipio pilot OK; harden before second pilot | Medium | This file §10 |

---

## 10. Roadmap before second pilot

Beyond this RUNBOOK, before adding municipio #2:

1. Tenant isolation via TypeORM subscriber (auto `WHERE tenant_id =`).
2. Test rehab — get to 80%+ coverage on auth, incidents, dispatch.
3. Hire / contract second on-call.
4. Set up `status.velnari.mx`.
5. SOC2 Type 1 readiness assessment.
6. DPIA (Data Protection Impact Assessment) under LFPDPPP México.

---

Last updated: 2026-04-14 — Ivan.
