# Response Time Headline on Insights Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a prominent "Tiempo de Respuesta" headline card on the Insights dashboard that shows this period's average response time and the % change vs yesterday — so commanders can immediately see if response times are improving or degrading.

**Architecture:** The backend already returns `DailySummary.avgResponseMinutes` (today's average) and `DailySummary.comparedToYesterday.responseTime` (delta in minutes vs yesterday). A new `ResponseTimeHeadline` component reads these values, computes % change, and renders a large card with color-coded trend (green = faster, red = slower). It's inserted above the existing "Incidentes del Día" section.

**Tech Stack:** Next.js / React, existing `DailySummary` type from `@/lib/types`, Tailwind CSS.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/src/components/dashboard/ResponseTimeHeadline.tsx` | Create | Headline card component |
| `apps/web/src/app/dashboard/page.tsx` | Modify | Import and render ResponseTimeHeadline |

---

### Task 1: Create ResponseTimeHeadline component

**Files:**
- Create: `apps/web/src/components/dashboard/ResponseTimeHeadline.tsx`

First, verify the `DailySummary` type by reading `apps/web/src/lib/types.ts` to confirm the shape of `comparedToYesterday.responseTime`.

- [ ] **Step 1: Read apps/web/src/lib/types.ts to confirm DailySummary shape**

Read `apps/web/src/lib/types.ts` to find the `DailySummary` interface and confirm `comparedToYesterday.responseTime` field type (number = delta in minutes).

- [ ] **Step 2: Write the component**

```typescript
// apps/web/src/components/dashboard/ResponseTimeHeadline.tsx
import type { DailySummary } from '@/lib/types';

interface Props {
  dailySummary: DailySummary;
}

export default function ResponseTimeHeadline({ dailySummary }: Props) {
  const avg = dailySummary.avgResponseMinutes;
  const delta = dailySummary.comparedToYesterday?.responseTime;

  // delta < 0 means today is faster (improved), > 0 means slower (degraded)
  const hasDelta = delta != null && avg != null;
  const improved = hasDelta && delta <= 0;
  const pct = hasDelta && delta !== 0
    ? Math.abs(Math.round((delta / (avg - delta)) * 100))
    : null;

  const trendColor = !hasDelta
    ? 'text-slate-gray'
    : improved
      ? 'text-green-400'
      : 'text-red-400';

  const trendBg = !hasDelta
    ? 'bg-slate-800'
    : improved
      ? 'bg-green-950/60 border border-green-800/50'
      : 'bg-red-950/60 border border-red-800/50';

  const trendLabel = !hasDelta
    ? null
    : improved && delta === 0
      ? 'Sin cambio vs ayer'
      : improved
        ? `${pct}% más rápido que ayer`
        : `${pct}% más lento que ayer`;

  return (
    <section className="mb-8">
      <h2 className="text-xs text-slate-gray uppercase tracking-widest mb-3 font-semibold">
        Tiempo de Respuesta
      </h2>
      <div className={`rounded-xl p-6 flex flex-col md:flex-row md:items-center gap-4 ${trendBg || 'bg-slate-800'}`}>
        {/* Big number */}
        <div className="flex items-end gap-3">
          <span className={`text-6xl font-bold font-mono ${trendColor}`}>
            {avg != null ? avg : '—'}
          </span>
          {avg != null && (
            <span className="text-slate-gray text-lg pb-2">min</span>
          )}
        </div>

        {/* Trend info */}
        <div className="flex flex-col gap-1">
          <p className="text-signal-white font-semibold text-lg">
            Promedio hoy
          </p>
          {trendLabel && (
            <p className={`text-sm font-medium ${trendColor}`}>
              {improved ? '↑' : '↓'} {trendLabel}
            </p>
          )}
          {!hasDelta && (
            <p className="text-slate-gray text-sm">Sin datos de ayer para comparar</p>
          )}
          <p className="text-slate-500 text-xs mt-1">Meta: &lt; 2 min</p>
        </div>

        {/* Goal indicator */}
        {avg != null && (
          <div className="md:ml-auto flex flex-col items-center md:items-end gap-1">
            <div
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                avg <= 2
                  ? 'bg-green-900 text-green-300'
                  : avg <= 5
                    ? 'bg-amber-900 text-amber-300'
                    : 'bg-red-900 text-red-300'
              }`}
            >
              {avg <= 2 ? '✓ Meta cumplida' : avg <= 5 ? '⚠ Cerca de la meta' : '✕ Fuera de meta'}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -i "ResponseTime\|DailySummary" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/ResponseTimeHeadline.tsx
git commit -m "feat(web): ResponseTimeHeadline component with yesterday comparison"
```

---

### Task 2: Add ResponseTimeHeadline to dashboard page

**Files:**
- Modify: `apps/web/src/app/dashboard/page.tsx`

- [ ] **Step 1: Read the current dashboard page to find insertion point**

Read `apps/web/src/app/dashboard/page.tsx` lines 216–245 to find the "Incidentes del Día" section.

- [ ] **Step 2: Add import and render**

At the top of `dashboard/page.tsx`, add the import:

```typescript
import ResponseTimeHeadline from '@/components/dashboard/ResponseTimeHeadline';
```

In the JSX, find the "Incidentes del Día" section (which starts with `<section className="mb-8">` and `<h2>Incidentes del Día</h2>`). Insert `ResponseTimeHeadline` immediately **before** it:

```tsx
{/* Response time headline — before incident stats */}
{dailySummary && (
  <ResponseTimeHeadline dailySummary={dailySummary} />
)}

{/* Incidents stats + Avg dispatch time */}
<section className="mb-8">
  ...
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -i "dashboard\|ResponseTime" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/page.tsx
git commit -m "feat(web): add response time headline card to Insights dashboard"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Prominent headline ✓, avg response time ✓, % change vs yesterday ✓, color coded ✓
- [x] **No placeholders:** Full component and page change shown ✓
- [x] **Null safety:** `avg != null` and `hasDelta` guards prevent crashes when data is absent ✓
- [x] **Delta direction:** `delta < 0` = faster (improved) = green; `delta > 0` = slower = red ✓
- [x] **Goal badge:** Shows pass/warn/fail relative to <2 min target ✓
- [x] **Existing DailySummary already fetched:** `dailySummary` is already in page state — no new API call ✓
