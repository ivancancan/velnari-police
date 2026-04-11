# Director Incident Export Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a `/admin/reports/export` page for directors and commanders to export incident data as CSV or a print-ready PDF covering any date range — beyond the single-day CSV in the current dashboard.

**Architecture:** New Next.js page at `apps/web/src/app/admin/reports/export/page.tsx`. Has date-range pickers (start + end), a "Cargar" button that fetches all incidents from the API using the existing `incidentsApi.getAll()` (filtering by date in-browser — the current API does not support date range query params, so we filter client-side). CSV export reuses the same pattern as the dashboard. PDF export uses `window.print()` with a print-only Tailwind class that hides controls and renders a clean table.

**Tech Stack:** Next.js `'use client'`, existing `incidentsApi` from `@/lib/api`, `window.print()`, Tailwind `print:` variant.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/src/app/admin/reports/export/page.tsx` | Create | Export page with date range, table, CSV and PDF buttons |
| `apps/web/src/app/admin/layout.tsx` or nav | Modify | Add link to export page (if admin layout/nav exists) |

---

### Task 1: Check if admin layout/nav exists

**Files:**
- Read: `apps/web/src/app/admin/`

- [ ] **Step 1: List the admin directory**

```bash
ls apps/web/src/app/admin/
```

Note what files/folders exist. If `layout.tsx` exists, read it to understand the nav pattern. If only `page.tsx` or subdirectories exist, check those.

- [ ] **Step 2: Check if there's an existing admin nav to link from**

Read the admin layout or page to find where to add the export link. Note the pattern (href, Link component, etc.).

---

### Task 2: Create the export page

**Files:**
- Create: `apps/web/src/app/admin/reports/export/page.tsx`

- [ ] **Step 1: Read apps/web/src/lib/api.ts to confirm incidentsApi.getAll signature**

Confirm `incidentsApi.getAll()` returns the full incidents list and the `Incident` type fields available for export.

- [ ] **Step 2: Write the export page**

```typescript
// apps/web/src/app/admin/reports/export/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { incidentsApi } from '@/lib/api';
import type { Incident } from '@/lib/types';
import { useAuthStore } from '@/store/auth.store';

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Bajo',
};
const TYPE_LABELS: Record<string, string> = {
  robbery: 'Robo', assault: 'Agresión', traffic: 'Accidente vial',
  noise: 'Ruido', domestic: 'Violencia doméstica',
  missing_person: 'Persona desaparecida', other: 'Otro',
};
const STATUS_LABELS: Record<string, string> = {
  open: 'Abierto', assigned: 'Asignado', en_route: 'En Ruta',
  on_scene: 'En Escena', closed: 'Cerrado',
};

export default function ExportPage() {
  const { user } = useAuthStore();
  const today = toDateString(new Date());
  const weekAgo = toDateString(new Date(Date.now() - 7 * 24 * 60 * 60_000));

  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function handleLoad() {
    setLoading(true);
    try {
      const res = await incidentsApi.getAll();
      const filtered = res.data.filter((inc) => {
        const d = inc.createdAt.slice(0, 10);
        return d >= startDate && d <= endDate;
      });
      // Sort newest first
      filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setIncidents(filtered);
      setLoaded(true);
    } catch {
      alert('Error al cargar incidentes.');
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    const headers = ['Folio', 'Tipo', 'Prioridad', 'Estado', 'Dirección', 'Fecha', 'Hora', 'Resolución'];
    const rows = incidents.map((inc) => [
      inc.folio,
      TYPE_LABELS[inc.type] ?? inc.type,
      PRIORITY_LABELS[inc.priority] ?? inc.priority,
      STATUS_LABELS[inc.status] ?? inc.status,
      inc.address ?? '',
      inc.createdAt.slice(0, 10),
      new Date(inc.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      inc.resolution ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incidentes-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-midnight-command">
      {/* Header — hidden on print */}
      <header className="print:hidden flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-slate-gray hover:text-signal-white text-sm transition-colors">
            ← Dashboard
          </Link>
          <span className="text-signal-white font-semibold">Exportar Incidentes</span>
        </div>
        <span className="text-sm text-slate-gray">{user?.name}</span>
      </header>

      <main className="px-6 py-8 max-w-6xl mx-auto">
        {/* Controls — hidden on print */}
        <div className="print:hidden mb-8 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-slate-gray mb-1">Desde</label>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white text-sm focus:outline-none focus:border-tactical-blue"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-gray mb-1">Hasta</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={today}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white text-sm focus:outline-none focus:border-tactical-blue"
            />
          </div>
          <button
            onClick={handleLoad}
            disabled={loading}
            className="bg-tactical-blue hover:bg-blue-600 disabled:opacity-50 text-white px-5 py-2 rounded text-sm font-semibold transition-colors"
          >
            {loading ? 'Cargando...' : 'Cargar'}
          </button>
          {loaded && (
            <>
              <button
                onClick={downloadCSV}
                disabled={incidents.length === 0}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-signal-white px-4 py-2 rounded text-sm transition-colors"
              >
                ↓ CSV
              </button>
              <button
                onClick={() => window.print()}
                disabled={incidents.length === 0}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-signal-white px-4 py-2 rounded text-sm transition-colors"
              >
                🖨 PDF
              </button>
            </>
          )}
        </div>

        {/* Print header — only shown on print */}
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-bold">Velnari — Reporte de Incidentes</h1>
          <p className="text-gray-600 text-sm">Período: {startDate} al {endDate} · Total: {incidents.length}</p>
        </div>

        {/* Results */}
        {loaded && incidents.length === 0 && (
          <p className="text-slate-gray text-center py-20 text-sm">
            Sin incidentes en el rango seleccionado.
          </p>
        )}

        {incidents.length > 0 && (
          <>
            <p className="print:hidden text-slate-gray text-xs mb-4">
              {incidents.length} incidentes encontrados
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 print:border-gray-300">
                    {['Folio', 'Tipo', 'Prioridad', 'Estado', 'Dirección', 'Fecha', 'Resolución'].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-xs text-slate-gray print:text-gray-500 uppercase tracking-widest font-semibold whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((inc) => (
                    <tr
                      key={inc.id}
                      className="border-b border-slate-800 print:border-gray-200 hover:bg-slate-800/40 print:hover:bg-transparent transition-colors"
                    >
                      <td className="px-3 py-2 font-mono text-signal-white print:text-black text-xs whitespace-nowrap">{inc.folio}</td>
                      <td className="px-3 py-2 text-slate-300 print:text-gray-800">{TYPE_LABELS[inc.type] ?? inc.type}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full print:border print:bg-transparent ${
                            inc.priority === 'critical' ? 'bg-red-900 text-red-300 print:border-red-500 print:text-red-700'
                              : inc.priority === 'high' ? 'bg-orange-900 text-orange-300 print:border-orange-500 print:text-orange-700'
                                : inc.priority === 'medium' ? 'bg-amber-900 text-amber-300 print:border-amber-500 print:text-amber-700'
                                  : 'bg-green-900 text-green-300 print:border-green-500 print:text-green-700'
                          }`}
                        >
                          {PRIORITY_LABELS[inc.priority] ?? inc.priority}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-300 print:text-gray-800">{STATUS_LABELS[inc.status] ?? inc.status}</td>
                      <td className="px-3 py-2 text-slate-400 print:text-gray-600 max-w-xs truncate">{inc.address ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-400 print:text-gray-600 whitespace-nowrap font-mono text-xs">
                        {inc.createdAt.slice(0, 10)}
                        <span className="ml-1 text-slate-500">
                          {new Date(inc.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-400 print:text-gray-600">{inc.resolution ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -i "export\|ExportPage" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/admin/reports/export/page.tsx
git commit -m "feat(web): director incident export page with CSV and print-to-PDF"
```

---

### Task 3: Add export link to admin nav

**Files:**
- Modify: existing admin layout or page (determined in Task 1)

- [ ] **Step 1: Add the link**

Based on what you found in Task 1, add a navigation link to `/admin/reports/export`. For example, if the admin page has a nav section:

```tsx
<Link href="/admin/reports/export" className="text-slate-gray hover:text-signal-white transition-colors text-sm">
  Exportar
</Link>
```

Or if there is a sidebar, add it there following the existing pattern.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/admin/
git commit -m "feat(web): add export link to admin navigation"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Date range picker ✓, CSV export ✓, PDF via print ✓, table with key fields ✓
- [x] **No placeholders:** Full page code shown with all labels, types, and formatting ✓
- [x] **Print CSS:** `print:hidden` on controls, `hidden print:block` on print header — clean PDF output ✓
- [x] **Client-side filtering:** API returns all incidents; we filter by date range in-browser (avoids API changes) ✓
- [x] **Resolution column:** Shows what the incident was resolved as — key for director reports ✓
- [x] **Sorting:** Newest first (`localeCompare` on ISO date strings) ✓
