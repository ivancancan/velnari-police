# Pre-Launch — Manual Actions for Ivan

These are the items I (Claude) cannot execute for you. Do them in order.
Estimated total: **3–5 hours** of focused work.

---

## 🔴 Critical — must finish before any production traffic

### 1. Purge leaked JWT secrets from git history (~30 min)

```bash
# Verify the leak still exists:
git log --all --full-history -- apps/api/.env.local-backup
git show a830f4e^:apps/api/.env.local-backup  # this should print secrets

# Purge using git-filter-repo (preferred over filter-branch):
brew install git-filter-repo
cd /Users/Ivan/Desktop/velnari-police
git filter-repo --path apps/api/.env.local-backup --invert-paths --force

# Force-push to all remotes:
git push origin --force --all
git push origin --force --tags

# Notify any other clones of the repo (CI runners, other devs):
# they need to delete + re-clone.
```

### 2. Rotate JWT secrets in Railway (~10 min)

```bash
# Generate new ones:
echo "JWT_SECRET=$(openssl rand -base64 64)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 64)"

# Paste into Railway → API project → Variables.
# Trigger redeploy.
# All users will be logged out — send heads-up in ops WhatsApp first.
```

### 3. Create Sentry projects + add DSNs (~30 min)

1. Sign up at sentry.io (free tier is fine for pilot — 5k events/month).
2. Create three projects: `velnari-api` (Node), `velnari-web` (Next.js), `velnari-mobile` (React Native).
3. Copy each DSN.

**API (Railway env):**
```
SENTRY_DSN=https://...@sentry.io/...
```

**Web (Vercel env):**
```
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_ORG=your-org
SENTRY_PROJECT=velnari-web
```

**Mobile (.env locally + EAS secrets for production builds):**
```
EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
EXPO_PUBLIC_ENV=production
```

For EAS:
```bash
cd apps/mobile
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "https://...@sentry.io/..."
```

Trigger one new build of each app and verify events show up in Sentry within 10 min.

### 4. Upgrade Supabase to Pro (~5 min + billing)

Free tier has no automated backups. Pro = $25/mo, includes daily backups
with 7-day retention + point-in-time recovery for the last 24 h.

Supabase dashboard → Project → Settings → Plan → Upgrade.

### 5. Set up uptime monitoring (~15 min)

UptimeRobot.com (free tier: 50 monitors, 5-min interval).

Add monitors:
- `https://api.velnari.mx/api/health` — expect 200, body contains `"status":"ok"`
- `https://app.velnari.mx/` — web dashboard
- (optional) ping the WS endpoint for realtime liveness

Set alert contact: WhatsApp via Zapier OR your email. **Test it fires** by
pausing one monitor.

### 6. Wire CI deploy hooks (~10 min)

The production workflow is gated on these GitHub repo secrets:

- `RAILWAY_DEPLOY_HOOK_URL` — Railway → API → Settings → Webhooks → Deploy hook
- `VERCEL_DEPLOY_HOOK_URL` — Vercel → Web → Settings → Git → Deploy Hooks
- (optional) `SENTRY_AUTH_TOKEN` for source-map upload

Settings → Secrets → Actions in GitHub.

---

## 🟠 High — do during launch week

### 7. Run database backup drill (~30 min)

Per RUNBOOK §8: spin up scratch Supabase project, restore yesterday's
backup, boot local API against it, verify incidents present. Document
restore time.

### 8. Brief supervisor on password resets (~15 min)

Mobile login now shows "¿Olvidaste tu contraseña?" → tells officer to ask
their supervisor. Make sure each supervisor knows:
- Path: web admin → /admin/users → click officer → reset password
- A temporary password is generated and shown once
- Supervisor delivers it in person or via secure radio
- Officer is forced to change it on next login (TODO: implement that flow,
  for pilot it's manual)

### 9. Verify Mexico privacy policy is published (~30 min — legal)

`https://velnari.mx/privacidad` is linked from both the mobile login and
web login footers. Make sure that page exists and complies with LFPDPPP
México:
- What data is collected (email, name, badge, GPS during shift)
- Retention period (incidents: 5 years per municipio policy; GPS: 90 days)
- User rights (ARCO: Acceso, Rectificación, Cancelación, Oposición)
- Contact for ARCO requests

Same for `https://velnari.mx/terminos`.

### 10. Test panic button on real device (~30 min)

The audit identified that GPS-failure broke the panic flow. The fix now
falls back to last-known-position (max 10 min stale). **Verify on a real
iPhone in a parking garage** that:
- Pressing-and-holding SOS for 1.5s triggers the alert
- Even without a current GPS fix, the alert fires with last-known location
- A toast confirms "Alerta enviada (ubicación aproximada)"

If it fails: the build is too risky to ship to officers. Contact me.

---

## 🟡 Medium — first 30 days

### 11. Add a second on-call

Bus factor = 1 today. Hire a contractor or train a second engineer through
this RUNBOOK before the second pilot.

### 12. Rehab the broken test specs (16–20 h)

Use Testcontainers for a real Postgres in CI. Replace QueryBuilder mocks
with actual DB calls. Tracked in `docs/SECURITY_TODO.md`.

### 13. Update e2e-dispatch.spec to use `current_location` (PostGIS)

The seed currently inserts `lat` / `lng` columns that no longer exist.
Replace with `ST_MakePoint($lng, $lat)` calls.

### 14. Set up `status.velnari.mx`

Use Statuspage.io or an UptimeRobot Pro public status page. Link from the
web app footer and from the mobile app's "Acerca de" screen (TODO: add
that screen).

### 15. SOC2 / DPIA prep

Engage a consultant. 2–3 month process. Required before B2G municipios at
scale.

---

## What I implemented for you (no action required)

Code-side, this branch ships:

| ID | Change | File(s) |
|----|--------|---------|
| C2 | `RolesGuard` now fail-closed on writes; missing-decorator endpoints patched | `roles.guard.ts`, `incidents/attachments/reports controllers` |
| C3 / M2 | Redis blacklist + login-fail counter have in-memory fallback (sticks during outage) | `redis-cache.service.ts` |
| H1 | Refresh-token rotation with replay detection — every refresh issues a new pair, old token blacklisted, replay revokes session | `auth.service.ts`, `auth.controller.ts` |
| H2 | bcrypt rounds 10 → 12 + lazy rehash on next login | `auth.service.ts`, `users.service.ts`, `seed.ts` |
| H3 | Tenant-scoped `findOne` on incidents (highest blast radius read) | `incidents.service.ts`, `incidents.controller.ts` |
| H4 | `@sentry/react-native` installed + initialized + scrubbing PII | `apps/mobile/src/lib/sentry.ts`, `app/_layout.tsx` |
| C4 | CI now gates on the passing test suites; broken specs explicitly quarantined | `.github/workflows/ci.yml` |
| UX | Mobile login: forgot-password helper + version footer + privacy link + actionable error copy | `app/login.tsx` |
| UX | Mobile home: "out of service" status confirms; panic button falls back to last-known GPS (10 min) | `app/(tabs)/home.tsx` |
| UX | Mobile map: priority shows letter `[C/A/M/B]` next to folio for colorblind officers | `app/(tabs)/map.tsx` |
| UX | Web login: trust line + version + privacy/terms links | `app/login/page.tsx` |
| Docs | RUNBOOK.md, this file, env-example updates | `docs/` |

All changes type-check clean (`pnpm exec tsc --noEmit`). Auth tests pass
(8/8 including new replay-detection tests). RolesGuard tests pass (7/7
including new fail-closed write enforcement).
