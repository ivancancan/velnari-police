# Security & Ops TODO — Pre-Production

Code-level fixes have been applied (see commit log). These items **require manual
action** outside the codebase and must be completed before the municipality pilot.

## 🔴 P0 — Do Before Pilot

### 1. Rotate JWT secrets (critical — possible leak in git history)

`apps/api/.env.local-backup` was committed in an earlier commit (since removed on
`a830f4e`) with plaintext `JWT_SECRET` and `JWT_REFRESH_SECRET`. Anyone with a
clone of the repo can recover those secrets via `git show a830f4e^:apps/api/.env.local-backup`.

**Action:**
1. Generate new 64-char random secrets:
   ```bash
   openssl rand -base64 64
   ```
2. Update in Railway production env: `JWT_SECRET`, `JWT_REFRESH_SECRET`.
3. All current users will be forced to re-login — expected.
4. *Optional but recommended:* purge the file from history entirely:
   ```bash
   git filter-repo --path apps/api/.env.local-backup --invert-paths
   git push --force-with-lease origin main
   ```
   Coordinate with any collaborators before doing this.

### 2. Configure Sentry in production (error visibility)

Code is already wired (`apps/api/src/shared/sentry.ts`, `apps/web/sentry.client.config.ts`).
Just needs DSN.

**Action:**
1. Create Sentry project at https://sentry.io (free tier OK for pilot).
2. Add to Railway env: `SENTRY_DSN=https://...@sentry.io/...`
3. Add to Vercel env: `NEXT_PUBLIC_SENTRY_DSN=...` (same DSN).
4. Deploy both; trigger a test error from /api/health route or web login with bad creds.
5. Verify event arrives in Sentry dashboard.

### 3. Upgrade Supabase to Pro tier ($25/mo)

Current: Free tier, no automated backups. A failed migration = hours of data loss.

**Action:**
- https://supabase.com/dashboard → Billing → Upgrade to Pro.
- Enables: daily backups (7-day retention), point-in-time recovery (PITR), 8 GB DB.

### 4. External uptime monitoring

**Action:**
- https://uptimerobot.com/ (free): create HTTP(s) monitor.
- URL: `https://velnariapi-production.up.railway.app/api/health`
- Interval: 5 min.
- Alerts: SMS + email to Ivan.
- Optional: configure Slack webhook via UptimeRobot integrations.

### 5. Configure production.yml GitHub secrets

The new `production.yml` workflow expects these repo secrets:
- `RAILWAY_DEPLOY_HOOK_URL` — Railway dashboard → Settings → Deploy Hooks
- `VERCEL_DEPLOY_HOOK_URL` — Vercel project → Settings → Git → Deploy Hooks
- `PRODUCTION_API_URL` — e.g. `https://velnariapi-production.up.railway.app`
- `SLACK_WEBHOOK_URL` — optional
- Create a `production` environment in repo Settings → Environments with required reviewers.

## 🟠 P1 — Within 2 Weeks of Pilot Start

### 6. Second on-call responder

Currently Ivan is sole P1 escalation. Train one other engineer / contractor on:
- How to access Railway logs + redeploy.
- How to access Supabase SQL editor.
- Rollback steps in `docs/runbooks/ops-runbook.md`.
- Update `docs/runbooks/oncall.md` rotation table.

### 7. Data residency statement

Supabase free/pro defaults to AWS us-east. For LFPDPPP (Mexican privacy law)
document:
- Where personal data is stored (region).
- Why (vendor availability) + mitigations (encryption at rest, TLS in transit).
- Alternative regions considered.

Add section to `docs/superpowers/plans/2026-04-10-privacy-notice.md`.

### 8. Status page

Public URL for municipality during outages. Options:
- Statuspage.io (free tier).
- GitHub Issues with `status` label.
- Betteruptime.com public page.

### 9. EAS mobile build (TestFlight)

`eas.json` is now in repo. Still need:
1. `npm i -g eas-cli && eas login`
2. In `apps/mobile/eas.json`, replace `REPLACE_WITH_*` placeholders with your Apple/Play IDs.
3. Set `EXPO_PUBLIC_SENTRY_DSN` in EAS build env (or rely on Expo's Sentry integration).
4. `eas build --platform ios --profile production`
5. `eas submit -p ios --latest`

## 🟠 P1.5 — Test infrastructure rehabilitation

The API unit/integration test suite is in a broken state (predates the
current CI pipeline). Failures observed in CI:

- `incidents.service.spec.ts` / `units.service.spec.ts` →
  `Cannot read properties of undefined (reading 'addSelect')` — the
  TypeORM repo mock doesn't return a chainable QueryBuilder.
- `attachments.service.spec.ts` →
  `Cannot read properties of undefined (reading 'native')` — S3 client
  mock missing.
- E2E tests → `password authentication failed for user "postgres"` even
  though Postgres is started in the CI job — likely missing migration run
  before tests, or connection string mismatch.
- `e2e-dispatch.spec.ts` → `column "lat" of relation "units" does not exist` —
  schema drift; test seeds expect columns that were replaced with
  `current_location` geometry.

CI runs tests with `continue-on-error: true` so signal is visible but
doesn't block merges. Plan:

1. Re-scaffold the repo mocks to use TypeORM's native test utilities
   (or factor mocks into a shared helper).
2. Add a pre-test migration step in CI (`pnpm db:migrate` against the
   CI postgres service before jest runs).
3. Update `e2e-dispatch.spec.ts` seed to use `ST_MakePoint` instead of
   `lat/lng` columns.
4. Once green, flip `continue-on-error: false` in `.github/workflows/ci.yml`.

## 🟡 P2 — Nice to Have

- Install `@sentry/react-native` (or `sentry-expo`) on mobile + wire in app.
- Account lockout currently blocks per-email; consider adding per-IP too for dist. attacks.
- Retention policy for audit logs (2 years default; archive to S3 after 90 days).
- Full i18n: some system strings still English in native dialogs.

## Summary of Code-Level Fixes Applied

| Fix | File |
|-----|------|
| SOS offline uses last-known GPS fallback; never queues zero coords | apps/mobile/app/(tabs)/home.tsx |
| Offline queue preserved on token refresh failure | apps/mobile/src/store/auth.store.ts · apps/mobile/src/lib/api.ts |
| Dispatch assignment wrapped in DB transaction | apps/api/src/modules/dispatch/dispatch.service.ts |
| Audit interceptor captures redacted request body | apps/api/src/shared/interceptors/audit.interceptor.ts |
| Graceful shutdown on SIGTERM/SIGINT | apps/api/src/main.ts |
| Account lockout after 10 failed logins per email (15-min window) | apps/api/src/modules/auth/auth.controller.ts |
| WebSocket room authorization by role | apps/api/src/modules/realtime/realtime.gateway.ts |
| CSP + security headers (HSTS, nosniff, frame-ancestors) | apps/web/next.config.mjs |
| Deleted `.env.local-backup` from filesystem (history still contains it — see P0#1) | apps/api/.env.local-backup |
| Docker GIT_SHA injection; health endpoint exposes version | apps/api/Dockerfile · health.controller.ts |
| `production.yml` CI/CD with smoke test + gated approval | .github/workflows/production.yml |
| `eas.json` for TestFlight/Play Store builds | apps/mobile/eas.json |
| Spanish permissions in Info.plist (NSMicrophone, NSPhotoLibrary) | apps/mobile/app.json |
| Mobile a11y labels on SOS, camera, GPS tracking buttons | apps/mobile/app/(tabs)/home.tsx |
| Double-click protection on SOS + photo capture | apps/mobile/app/(tabs)/home.tsx |
| Sector boundary save failure surfaces to operator | apps/web/src/components/map/CommandMap.tsx |
