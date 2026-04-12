# Velnari — On-Call Schedule & Escalation

> **Update this file** every time the rotation changes.  
> Last updated: 2026-04-12

---

## Rotation

| Week | Primary | Backup |
|------|---------|--------|
| Current | Ivan Cantú | — |
| Fill this in | Name | Name |

**Rotation cadence:** Weekly, handoff Mondays at 09:00 CST  
**Coverage required:** 24/7 during active pilot. After pilot ends, business hours only.

---

## Contact card

### Ivan Cantú (founder / primary)
- WhatsApp / Signal: +52 33 1990 3510
- Email: ivan@velnari.mx
- Response SLA: P1 → 5 min, P2 → 15 min, P3 → 2 hours

---

## Escalation order

For P1 incidents (platform down, no dispatch possible):

1. **Primary on-call** — respond within 5 minutes
2. **Backup on-call** — if primary unreachable after 10 minutes
3. **Municipality contact** — if dispatch is impossible for > 30 minutes, notify:
   - Name: [Director de Seguridad Pública]
   - Phone: [number]
   - They will activate radio fallback protocol

---

## Alerting channels

| Channel | Tool | Who gets paged |
|---------|------|----------------|
| API error spike | Sentry email alert | Primary on-call |
| Health check failure | Uptime monitor (set up UptimeRobot or BetterUptime) | Primary on-call |
| P1 incident | WhatsApp group "Velnari Ops" | Both on-call |

---

## Handoff checklist (Monday 09:00 CST)

Outgoing on-call sends to incoming on-call via WhatsApp:

- [ ] Any open incidents or degradations from the past week?
- [ ] Any deploy planned this week that needs monitoring?
- [ ] Anything weird in Sentry or Railway logs?
- [ ] Database backup verified this week? (Railway auto-backup or manual RDS snapshot)

---

## Tools access needed for on-call

Make sure on-call engineer has access to:

- [ ] Railway project (deployment + logs + rollback)
- [ ] Sentry organization
- [ ] AWS console (RDS, S3, CloudWatch) — if on AWS
- [ ] GitHub repository (for hotfix PRs)
- [ ] Production DB credentials (stored in 1Password / Bitwarden, not in Slack)

---

## SLA targets (pilot phase)

| Metric | Target |
|--------|--------|
| API uptime | ≥ 99% per week |
| P1 time-to-respond | ≤ 5 min |
| P1 time-to-resolve | ≤ 60 min |
| P2 time-to-resolve | ≤ 4 hours |
| GPS stale on >50% units | Treat as P2 |
