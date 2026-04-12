# Velnari — Operations Runbook v1

> **Audience:** Dispatcher, supervisor, on-call engineer  
> **Last updated:** 2026-04-12  
> **On-call contact:** see [oncall.md](oncall.md)

---

## Severity levels

| Level | Definition | Response time |
|-------|-----------|---------------|
| **P1 — Critical** | Platform down, no dispatch possible, units invisible on map | Immediate — wake someone up |
| **P2 — High** | Partial outage (realtime down, single feature broken), active incident affected | < 15 min |
| **P3 — Medium** | Degraded performance, non-critical feature broken | < 2 hours |
| **P4 — Low** | Cosmetic issue, single user affected | Next business day |

---

## Scenario 1 — API is down

**Symptoms:** Web app shows "Reconectando…", units not updating, dispatchers can't create incidents.

1. Check health endpoint: `curl https://api.velnari.mx/api/health`
   - If 503: database is unreachable → go to step 2
   - If no response: API process is down → go to step 3
2. **Database unreachable**
   - Log into Railway / AWS RDS console, verify the DB instance is running
   - Check if max connections are exhausted (RDS → Performance Insights)
   - If overloaded: restart the API service (this resets connection pool)
3. **API process down**
   - Railway: go to your project → velnari-api → redeploy the latest successful build
   - Check deploy logs for the specific error
   - Common causes: missing env var (check startup logs for `[STARTUP] Missing required…`), OOM kill
4. Notify dispatcher: "Estamos restableciendo el sistema, continúen por radio hasta nuevo aviso"
5. Open a P1 incident ticket and link the deploy logs

---

## Scenario 2 — Real-time stopped updating (WebSocket disconnected)

**Symptoms:** "Reconectando…" badge in header, unit markers frozen on map, no new incident alerts.

1. Check if the API is healthy: `curl https://api.velnari.mx/api/health`
2. If API is healthy, the issue is WS-specific:
   - Check API logs for `[Realtime]` errors in Railway / CloudWatch
   - The client auto-reconnects with exponential backoff (1s → 30s). Wait 60 seconds.
   - If still disconnected after 60s: hard-refresh the browser (Cmd+Shift+R / Ctrl+Shift+R)
3. If reconnect fails after refresh: check if the JWT token expired (session > 15 min idle)
   - Operator should log out and log back in
4. Escalate to P2 if more than 3 operators are affected simultaneously

---

## Scenario 3 — GPS stale on all units ("⚡ sin GPS" on all markers)

**Symptoms:** All unit markers show the stale badge, unit positions not updating.

1. Confirm the issue: check if `unit:gps:stale` alerts are firing for multiple units at once
2. Check if the mobile app is running on field units (call a unit and ask them to open the app)
3. Check server-side: `GET /api/units` and look at `lastLocationAt` timestamps in the response
4. If `lastLocationAt` is recent but map doesn't update: WS issue (see Scenario 2)
5. If `lastLocationAt` is stale across all units:
   - Network outage in the field area? Check with units via radio
   - Mobile background location permission revoked? Ask units to check app permissions → Settings → Location → Always
   - iOS specific: background app refresh may have been disabled → Settings → General → Background App Refresh → Velnari

---

## Scenario 4 — Dispatcher locked out (can't log in)

1. **Wrong password:** Admin resets via Admin panel → Usuarios → [user] → Restablecer contraseña
   - See [password-reset.md](password-reset.md) for full procedure
2. **Account disabled:** Admin → Usuarios → [user] → toggle "Activo"
3. **Admin locked out:**
   - Contact the on-call engineer (see [oncall.md](oncall.md))
   - Engineer runs: `pnpm --filter api db:seed` only in an emergency dev environment (never in prod)
   - Production fix: engineer updates password hash directly via secure DB access

---

## Scenario 5 — Incident incorrectly closed / can't reopen

Incidents are immutable once closed (by design for audit). Workaround:

1. Create a new incident with the same location and type
2. Note in the description: "Continuación de folio [original folio]"
3. Add a note to the original incident: "Continuado como [new folio]"
4. Assign the same unit

---

## Scenario 6 — Unit assigned to wrong incident

1. Open the incident in Command panel
2. Click "Reasignar unidad" → confirm the dialog
3. Assign the correct unit
4. The timeline will show both assignment events (full audit trail is preserved)

---

## Scenario 7 — Database migration failure during deploy

**Symptoms:** Deploy succeeds but API crashes on startup with TypeORM migration error.

1. Check migration logs in Railway / CI pipeline
2. If migration partially applied: **do not run migrations again** — contact on-call engineer
3. Engineer connects to the DB and checks `migrations` table for partial state
4. Run rollback: `pnpm --filter api db:migrate:revert` (reverts last migration)
5. Fix the migration SQL, redeploy

---

## Scenario 8 — Sentry reports spike in errors

1. Go to Sentry → Issues → sort by "First Seen" descending
2. Check if errors share the same stack trace (single root cause) or are scattered (broader outage)
3. For a single root cause: check the relevant service (units, incidents, dispatch)
4. For scattered errors: check if a recent deploy was pushed (Railway → Deployments)
5. If a bad deploy caused it: Railway → Deployments → "Rollback" to the previous version
6. Acknowledge the Sentry issue and assign to the on-call engineer

---

## Daily checklist (shift start)

Before each 8-hour shift, the supervisor or operator should verify:

- [ ] Web app loads and shows "En vivo" in the header
- [ ] All expected units are visible on the map
- [ ] At least one test incident can be created and immediately closed (use type "noise", low priority)
- [ ] Chat panel shows previous messages
- [ ] No units showing "⚡ sin GPS" at shift start

---

## Emergency contact chain

See [oncall.md](oncall.md) for names, phones, and escalation order.

---

## Useful commands

```bash
# Check API health
curl https://api.velnari.mx/api/health

# Check unit GPS freshness (requires admin token)
curl -H "Authorization: Bearer $TOKEN" https://api.velnari.mx/api/units/stats

# Tail Railway logs (requires Railway CLI)
railway logs --service velnari-api

# Manual migration (run from apps/api)
pnpm db:migrate

# Revert last migration
pnpm db:migrate:revert

# Reset all data (DEV ONLY — NEVER IN PRODUCTION)
pnpm db:seed
```
