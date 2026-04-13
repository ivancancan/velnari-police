'use client';

import dynamic from 'next/dynamic';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts';
import type { InsightsData } from '@/hooks/useInsightsData';
import { CHART_COLORS, PRIORITY_COLORS, PRIORITY_LABELS, TYPE_LABELS, CHART_DEFAULTS } from './chartTheme';

const InsightsHeatmap = dynamic(() => import('./InsightsHeatmap'), { ssr: false });

interface Props {
  data: InsightsData;
}

function fmtDate(dateStr: string, totalDays: number) {
  const d = new Date(dateStr);
  if (totalDays <= 7) return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

export default function AnalyticsSection({ data }: Props) {
  const cur = data.current;
  const prev = data.previous;
  if (!cur) return null;

  const totalDays = cur.byDay.length;
  const tickInterval = totalDays <= 7 ? 0 : totalDays <= 14 ? 1 : Math.floor(totalDays / 7);

  // ── Trend chart ──────────────────────────────────────────────────────────
  const trendData = cur.byDay.map((d, i) => ({
    date: fmtDate(d.date, totalDays),
    actual: d.count,
    anterior: prev?.byDay[i]?.count ?? null,
  }));

  // ── By type bar chart ─────────────────────────────────────────────────────
  const typeData = Object.entries(cur.byType)
    .map(([k, v]) => ({ name: TYPE_LABELS[k] ?? k, value: v }))
    .sort((a, b) => b.value - a.value);

  // ── By priority donut ─────────────────────────────────────────────────────
  const priorityData = ['critical', 'high', 'medium', 'low']
    .map((p) => ({ name: PRIORITY_LABELS[p], value: cur.byPriority[p] ?? 0, color: PRIORITY_COLORS[p] }))
    .filter((d) => d.value > 0);

  // ── Unit performance ──────────────────────────────────────────────────────
  const unitData = cur.byUnit
    .filter((u) => u.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((u) => ({
      name: u.callSign,
      incidentes: u.count,
      despacho: u.avgResponseMin ? parseFloat(u.avgResponseMin.toFixed(1)) : null,
    }));

  // ── Hourly heatmap ────────────────────────────────────────────────────────
  const hourMax = Math.max(...cur.byHour.map((h) => h.count), 1);
  const hours = Array.from({ length: 24 }, (_, i) => {
    const h = cur.byHour.find((x) => x.hour === i);
    return { hour: i, count: h?.count ?? 0 };
  });

  // ── Closure rate over time (simulated from byDay) ─────────────────────────
  const closureRate = cur.summary.totalIncidents > 0
    ? Math.round((cur.summary.closedIncidents / cur.summary.totalIncidents) * 100)
    : 0;

  // ── Sector ranking ────────────────────────────────────────────────────────
  const sectorData = cur.bySector.slice().sort((a, b) => b.count - a.count).slice(0, 5);
  const sectorMax = sectorData[0]?.count ?? 1;

  return (
    <div className="px-4 sm:px-6 pb-8 space-y-6">

      {/* ── Full-width trend ─────────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] text-slate-400 uppercase tracking-widest">Tendencia de incidentes</p>
            <p className="text-xs text-slate-500 mt-0.5">{totalDays} días · {cur.summary.totalIncidents} total</p>
          </div>
          {prev && (
            <div className="flex items-center gap-4 text-[10px]">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-5 h-0.5 bg-tactical-blue inline-block rounded" />
                Período actual
              </span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-5 border-t border-dashed border-slate-500 inline-block" />
                Período anterior
              </span>
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradSlate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#64748b" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_DEFAULTS.gridColor} />
            <XAxis dataKey="date" tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }}
              tickLine={false} interval={tickInterval} />
            <YAxis tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={CHART_DEFAULTS.tooltipStyle} />
            {prev && (
              <Area type="monotone" dataKey="anterior" stroke={CHART_COLORS.slate}
                strokeWidth={1.5} strokeDasharray="4 3" fill="url(#gradSlate)"
                dot={false} name="Anterior" connectNulls />
            )}
            <Area type="monotone" dataKey="actual" stroke={CHART_COLORS.blue}
              strokeWidth={2.5} fill="url(#gradBlue)"
              dot={totalDays <= 7 ? { fill: CHART_COLORS.blue, r: 4 } : false}
              name="Actual" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Middle row: type bars + priority donut + unit performance ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Por tipo */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <p className="text-[11px] text-slate-400 uppercase tracking-widest mb-4">Incidentes por tipo</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={typeData} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_DEFAULTS.gridColor} horizontal={false} />
              <XAxis type="number" tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }}
                tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#cbd5e1', fontSize: 10 }}
                tickLine={false} axisLine={false} width={70} />
              <Tooltip contentStyle={CHART_DEFAULTS.tooltipStyle} />
              <Bar dataKey="value" name="Incidentes" radius={[0, 4, 4, 0]}>
                {typeData.map((_, i) => (
                  <Cell key={i} fill={
                    [CHART_COLORS.red, CHART_COLORS.orange, CHART_COLORS.amber,
                     CHART_COLORS.blue, CHART_COLORS.purple, CHART_COLORS.green, CHART_COLORS.slate][i % 7]
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Por prioridad */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col">
          <p className="text-[11px] text-slate-400 uppercase tracking-widest mb-4">Distribución por prioridad</p>
          <div className="flex items-center justify-center gap-6 flex-1">
            <PieChart width={140} height={140}>
              <Pie data={priorityData} cx={65} cy={65} innerRadius={40} outerRadius={62}
                dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                {priorityData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={CHART_DEFAULTS.tooltipStyle} />
            </PieChart>
            <div className="flex flex-col gap-2.5">
              {priorityData.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <div>
                    <p className="text-[11px] text-slate-200 leading-none">{d.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{d.value} inc · {Math.round(d.value / cur.summary.totalIncidents * 100)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Closure rate pill */}
          <div className="mt-4 flex items-center justify-between bg-slate-800/60 rounded-xl px-3 py-2">
            <span className="text-[10px] text-slate-400">Tasa de cierre</span>
            <span className="text-[13px] font-bold" style={{ color: closureRate >= 70 ? CHART_COLORS.green : CHART_COLORS.amber }}>
              {closureRate}%
            </span>
          </div>
        </div>

        {/* Unidades */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <p className="text-[11px] text-slate-400 uppercase tracking-widest mb-4">Rendimiento de unidades</p>
          <div className="flex flex-col gap-3">
            {unitData.map((u, i) => {
              const maxInc = unitData[0]?.incidentes ?? 1;
              return (
                <div key={u.name} className="flex items-center gap-2.5">
                  <span className="text-[10px] font-mono text-slate-400 w-4 shrink-0">{i + 1}</span>
                  <span className="text-[11px] font-mono text-signal-white w-9 shrink-0">{u.name}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${(u.incidentes / maxInc) * 100}%`,
                        backgroundColor: i === 0 ? CHART_COLORS.amber : CHART_COLORS.blue,
                      }} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-300 w-5 text-right shrink-0">{u.incidentes}</span>
                  {u.despacho != null && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md shrink-0"
                      style={{
                        backgroundColor: u.despacho <= 2 ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                        color: u.despacho <= 2 ? CHART_COLORS.green : CHART_COLORS.amber,
                      }}>
                      {u.despacho}m
                    </span>
                  )}
                </div>
              );
            })}
            {unitData.length === 0 && <p className="text-slate-500 text-xs">Sin datos de unidades</p>}
          </div>
        </div>
      </div>

      {/* ── Bottom row: hourly heatmap + sector ranking ───────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Heatmap horario */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] text-slate-400 uppercase tracking-widest">Actividad por hora del día</p>
            <div className="flex items-center gap-1.5">
              {[0.15, 0.35, 0.55, 0.75, 0.95].map((v) => (
                <div key={v} className="w-4 h-3 rounded-sm" style={{ backgroundColor: `rgba(239,68,68,${v})` }} />
              ))}
              <span className="text-[9px] text-slate-600 ml-1">baja → alta</span>
            </div>
          </div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
            {hours.map(({ hour, count }) => {
              const intensity = count / hourMax;
              return (
                <div key={hour} className="flex flex-col items-center gap-1">
                  <div
                    title={`${String(hour).padStart(2, '0')}:00 — ${count} inc`}
                    className="w-full rounded cursor-default"
                    style={{
                      height: 36,
                      backgroundColor: intensity > 0
                        ? `rgba(239,68,68,${Math.max(intensity * 0.9, 0.12)})`
                        : '#0f172a',
                    }}
                  />
                  {hour % 6 === 0 && (
                    <span className="text-[8px] text-slate-600">{String(hour).padStart(2, '0')}h</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sectores */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <p className="text-[11px] text-slate-400 uppercase tracking-widest mb-4">Zonas con mayor actividad</p>
          {sectorData.length === 0 ? (
            <p className="text-slate-500 text-xs">Sin datos de sectores</p>
          ) : (
            <div className="flex flex-col gap-3 mt-1">
              {sectorData.map((s, i) => (
                <div key={s.sectorId} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold"
                    style={{
                      backgroundColor: i === 0 ? 'rgba(239,68,68,0.2)' : 'rgba(100,116,139,0.15)',
                      color: i === 0 ? '#ef4444' : '#64748b',
                    }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-slate-200 truncate">{s.sectorName}</p>
                    <div className="mt-1 w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{
                          width: `${(s.count / sectorMax) * 100}%`,
                          backgroundColor: i === 0 ? '#ef4444' : '#3b82f6',
                        }} />
                    </div>
                  </div>
                  <span className="text-[12px] font-mono text-slate-300 shrink-0">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Mapa de calor ────────────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <p className="text-[11px] text-slate-400 uppercase tracking-widest">Mapa de calor — distribución geográfica</p>
            <p className="text-xs text-slate-500 mt-0.5">{data.heatmapPoints?.length ?? 0} puntos en el período</p>
          </div>
        </div>
        <div style={{ height: 380 }}>
          <InsightsHeatmap points={data.heatmapPoints ?? []} />
        </div>
      </div>

    </div>
  );
}
