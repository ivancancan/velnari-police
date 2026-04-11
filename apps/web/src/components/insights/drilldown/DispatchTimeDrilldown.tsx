'use client';

import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis,
  Tooltip, BarChart, Bar, Cell,
} from 'recharts';
import type { AnalyticsResult } from '@/lib/types';
import { CHART_COLORS, PRIORITY_COLORS, PRIORITY_LABELS, CHART_DEFAULTS } from '../chartTheme';

interface Props {
  data: AnalyticsResult;
  prevData: AnalyticsResult | null;
}

export default function DispatchTimeDrilldown({ data, prevData }: Props) {
  const byDayFormatted = data.byDay.map((d) => ({
    date: new Date(d.date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
    count: d.count,
  }));

  const priorityBars = ['critical', 'high', 'medium', 'low'].map((p) => ({
    name: PRIORITY_LABELS[p] ?? p,
    count: data.byPriority[p] ?? 0,
    color: PRIORITY_COLORS[p] ?? CHART_COLORS.slate,
  }));

  const unitBars = data.byUnit
    .filter((u) => u.avgResponseMin != null)
    .slice(0, 6)
    .sort((a, b) => (a.avgResponseMin ?? 99) - (b.avgResponseMin ?? 99))
    .map((u) => ({ name: u.callSign, min: u.avgResponseMin ?? 0 }));

  void prevData;

  return (
    <div className="grid grid-cols-3 gap-6">
      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Incidentes por día</p>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={byDayFormatted} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_DEFAULTS.gridColor} />
            <XAxis dataKey="date" tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: CHART_DEFAULTS.fontSize }} tickLine={false} />
            <YAxis tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: CHART_DEFAULTS.fontSize }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={CHART_DEFAULTS.tooltipStyle} />
            <Line type="monotone" dataKey="count" stroke={CHART_COLORS.green} strokeWidth={2} dot={{ fill: CHART_COLORS.green, r: 3 }} name="Incidentes" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Por prioridad</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={priorityBars} layout="vertical" margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_DEFAULTS.gridColor} horizontal={false} />
            <XAxis type="number" tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: CHART_DEFAULTS.fontSize }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: CHART_DEFAULTS.fontSize }} tickLine={false} axisLine={false} width={50} />
            <Tooltip contentStyle={CHART_DEFAULTS.tooltipStyle} />
            <Bar dataKey="count" radius={[0, 3, 3, 0]} name="Incidentes">
              {priorityBars.map((b, i) => <Cell key={i} fill={b.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Despacho por unidad (min)</p>
        <div className="flex flex-col gap-2">
          {unitBars.map((u) => (
            <div key={u.name} className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-signal-white w-10 shrink-0">{u.name}</span>
              <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min((u.min / 10) * 100, 100)}%`,
                    backgroundColor: u.min <= 2 ? CHART_COLORS.green : u.min <= 5 ? CHART_COLORS.amber : CHART_COLORS.red,
                  }}
                />
              </div>
              <span className="text-[10px] text-slate-400 w-10 text-right">{u.min.toFixed(1)}m</span>
            </div>
          ))}
          {unitBars.length === 0 && <p className="text-slate-500 text-xs">Sin datos</p>}
        </div>
      </div>
    </div>
  );
}
