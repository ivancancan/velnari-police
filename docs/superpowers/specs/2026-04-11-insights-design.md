# Velnari Insights — Design Spec
**Date:** 2026-04-11

---

## Overview

A new `/insights` route in the web app that gives commanders and administrators a KPI-first analytics dashboard with date range filtering and drill-down charts. Supervisors get a read-only day view.

---

## Users & Access

| Role | Access | Date filter |
|------|--------|-------------|
| `admin` | Full — all KPIs, all date ranges, export | Any range |
| `commander` | Full — all KPIs, all date ranges, export | Any range |
| `supervisor` | Read-only — all KPIs, no export | Today only (locked) |
| `operator`, `field_unit` | No access — redirect to /command | — |

Route guard: server-side middleware checks JWT role. Unauthorized roles redirect to `/command`.

---

## Layout

Single page at `/insights`. No sub-routes.

```
┌─────────────────────────────────────────────────────────┐
│ SIDEBAR (shared app nav — already exists)               │
│  + 📊 Insights link added                               │
├─────────────────────────────────────────────────────────┤
│ HEADER                                                  │
│  "📊 Velnari Insights" · subtitle                       │
│  [Hoy] [Esta semana*] [Este mes] [Trimestre] | 📅 custom│
├─────────────────────────────────────────────────────────┤
│ KPI GRID (4 columns, responsive → 2 on mobile)          │
│  Each card: label · value · subtitle · trend · sparkline│
│  Click → card expands to full-width with drill-down     │
├─────────────────────────────────────────────────────────┤
│ EXPORT ROW                                              │
│  [⬇ CSV] [📄 PDF] [📤 SESNSP]  (admin/commander only)  │
└─────────────────────────────────────────────────────────┘
```

---

## Date Range Selector

Presets (mutually exclusive, one active at a time):
- **Hoy** — current calendar day
- **Esta semana** — Monday 00:00 → today 23:59 (default)
- **Este mes** — 1st of month → today
- **Último trimestre** — 90 days back → today
- **Custom** — date picker, from/to, any range

Supervisor role: presets hidden, date locked to today, no custom picker shown.

All presets compute `from` / `to` ISO timestamps client-side and pass them to the API. Every KPI card and drill-down chart re-fetches when the date range changes.

---

## KPI Cards

10 cards rendered in a 4-column grid. Each card shows:
- **Label** (icon + text)
- **Value** (large, colored by semantic meaning)
- **Subtitle** (context — e.g. "Abiertos: 12 · Cerrados: 235")
- **Trend** (vs previous equivalent period — e.g. "▼ 34% vs semana anterior")
- **Sparkline** (7-bar mini chart showing daily trend within period)
- **"clic para expandir ↗"** hint

### Card list

| # | Label | Value color | API source |
|---|-------|-------------|------------|
| 1 | 📋 Total incidentes | Blue `#3b82f6` | `GET /incidents/analytics` → `summary.totalIncidents` |
| 2 | ⏱ Tiempo de despacho promedio | Green `#22c55e` | `summary.avgResponseMinutes` |
| 3 | 🚔 Tiempo de arribo promedio | Blue `#3b82f6` | `summary.avgCloseMinutes` (proxy until arrived_at is tracked) |
| 4 | ✅ Cumplimiento SLA | Purple `#a78bfa` | `GET /incidents/sla-compliance` → overall % |
| 5 | 🟢 Unidades activas | Green `#22c55e` | `GET /units/stats` → active count / total |
| 6 | 🚨 Incidentes críticos | Red `#ef4444` | `byPriority.critical` |
| 7 | 📊 Tasa de cierre | Amber `#f59e0b` | `closedIncidents / totalIncidents * 100` |
| 8 | 🏆 Mejor unidad | Amber `#f59e0b` | `byUnit[0]` sorted by incidents + avgResponseMin |
| 9 | 🗺 Zona más activa | Amber `#f59e0b` | `bySector[0]` sorted by count |
| 10 | 📍 Cobertura patrullaje | Green `#22c55e` | `GET /patrols` → coverage % (computed from GPS points in sector polygon) |

Trend is computed by making a second API call for the previous equivalent period and calculating percentage change client-side.

---

## Drill-Down

Only one card can be expanded at a time. Clicking an already-expanded card collapses it. Expanded card spans full 4-column width (CSS `grid-column: span 4`).

Each card has its own drill-down content:

**1. Total incidentes** → bar chart by day + donut by type + donut by priority

**2. Tiempo de despacho** → line chart by day (with baseline reference line) + horizontal bars by priority + ranking table by unit

**3. Tiempo de arribo** → line chart by day + bars by unit

**4. SLA** → stacked bar by priority (met vs missed) + table with target vs actual per priority level

**5. Unidades activas** → unit status grid (colored squares) + hours online per unit bar chart

**6. Incidentes críticos** → list of critical incidents with folio, address, response time + bar chart by day

**7. Tasa de cierre** → line chart by day + breakdown open/assigned/closed

**8. Mejor unidad** → full unit scorecard: incidents, avg response, SLA %, GPS points, hours on duty

**9. Zona más activa** → incident count by sector (bar chart) + hour-of-day heatmap grid (24×7)

**10. Cobertura patrullaje** → patrol timeline per unit + coverage % bar by unit

---

## Charts Library

Install **Recharts** (`recharts` + `@types/recharts` already has types bundled).

Chart types used:
- `<LineChart>` — trends over time
- `<BarChart>` — rankings, distributions
- `<ComposedChart>` — line + bar combined
- `<PieChart>` — donut charts (priority/type breakdowns)
- Custom CSS grid — hour-of-day heatmap (24 columns × 7 rows)

All charts use the Velnari color palette:
- Tactical Blue `#3b82f6`
- Alert Amber `#f59e0b`
- Signal Green `#22c55e`
- Critical Red `#ef4444`
- Slate Gray `#64748b`
- Purple (SLA) `#a78bfa`

Chart background: `#0f172a`. Grid lines: `#1e293b`. Tooltip: glassmorphism `bg-slate-900/80 backdrop-blur`.

---

## Export (admin + commander only)

Three export buttons in a row below the KPI grid:

- **⬇ Exportar CSV** — calls existing `GET /incidents/analytics` with `format=csv` param (already implemented in API)
- **📄 Exportar PDF** — client-side `window.print()` with print CSS that hides nav and renders KPI cards cleanly
- **📤 Reporte SESNSP** — calls `GET /incidents/sesnsp-export?from=&to=` (already implemented), downloads as CSV

---

## API Endpoints Used

All existing — no new endpoints needed:

```
GET /api/incidents/analytics?from=&to=&unitId=&sectorId=
GET /api/incidents/sla-compliance?from=&to=
GET /api/incidents/trends?weeks=4
GET /api/incidents/heatmap?from=&to=
GET /api/incidents/sesnsp-export?from=&to=
GET /api/units/stats
GET /api/patrols
```

---

## File Structure

```
apps/web/src/
  app/
    insights/
      page.tsx                  — route, role guard, date state, layout
      layout.tsx                — wraps with shared app shell (if needed)
  components/
    insights/
      DateRangeSelector.tsx     — preset buttons + custom date picker
      KpiCard.tsx               — card with value, trend, sparkline, expand logic
      KpiGrid.tsx               — 4-col grid, manages which card is expanded
      drilldown/
        IncidentsTotalDrilldown.tsx
        DispatchTimeDrilldown.tsx
        ArrivalTimeDrilldown.tsx
        SlaDrilldown.tsx
        UnitsActiveDrilldown.tsx
        CriticalsDrilldown.tsx
        ClosureRateDrilldown.tsx
        BestUnitDrilldown.tsx
        HotspotDrilldown.tsx
        PatrolCoverageDrilldown.tsx
      Sparkline.tsx             — 7-bar mini chart (no recharts, pure CSS/SVG)
      ExportBar.tsx             — CSV / PDF / SESNSP buttons
  hooks/
    useInsightsData.ts          — fetches analytics + previous period for trends
```

---

## Supervisor View Differences

When role === `supervisor`:
- Date presets hidden, replaced with "Hoy" label (non-clickable)
- Custom date picker hidden
- Export buttons hidden
- All KPI cards and drill-downs visible (read-only)
- Page title shows "Vista del turno — [today's date]"

---

## Responsive

- **≥1280px** — 4-column KPI grid
- **768–1279px** — 2-column KPI grid
- **<768px** — 1-column, drill-down takes full screen (mobile not a priority for this role, but shouldn't break)
