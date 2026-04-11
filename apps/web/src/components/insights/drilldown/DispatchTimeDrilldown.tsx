'use client';

import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis,
  Tooltip, BarChart, Bar, Cell, Legend,
} from 'recharts';
import type { AnalyticsResult } from '@/lib/types';
import { CHART_COLORS, PRIORITY_COLORS, PRIORITY_LABELS, CHART_DEFAULTS } from '../chartTheme';

interface Props {
  data: AnalyticsResult;
  prevData: AnalyticsResult | null;
}

function fmtDate(dateStr: string, totalDays: number) {
  const d = new Date(dateStr);
  if (totalDays <= 7) return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
  if (totalDays <= 31) return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

export default function DispatchTimeDrilldown({ data, prevData }: Props) {
  const totalDays = data.byDay.length;

  // Merge current + previous period by index for comparison line
  const byDayFormatted = data.byDay.map((d, i) => {
    const prev = prevData?.byDay[i];
    return {
      date: fmtDate(d.date, totalDays),
      actual: d.count,
      anterior: prev?.count ?? null,
    };
  });

  // Show every Nth label so they don't overlap
  const tickInterval = totalDays <= 7 ? 0 : totalDays <= 14 ? 1 : Math.floor(totalDays / 7);

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

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Tendencia por día — actual vs período anterior */}
      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">
          Incidentes por día {prevData ? '(vs período anterior)' : ''}
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={byDayFormatted} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_DEFAULTS.gridColor} />
            <XAxis
              dataKey="date"
              tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 9 }}
              tickLine={false}
              interval={tickInterval}
            />
            <YAxis tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={CHART_DEFAULTS.tooltipStyle} />
            {prevData && (
              <Line
                type="monotone" dataKey="anterior"
                stroke={CHART_COLORS.slate} strokeWidth={1.5} strokeDasharray="4 2"
                dot={false} name="Período anterior"
                connectNulls
              />
            )}
            <Line
              type="monotone" dataKey="actual"
              stroke={CHART_COLORS.green} strokeWidth={2}
              dot={totalDays <= 7 ? { fill: CHART_COLORS.green, r: 3 } : false}
              name="Período actual"
            />
            {prevData && <Legend wrapperStyle={{ fontSize: 9, color: CHART_DEFAULTS.tickColor }} />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Por prioridad */}
      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Por prioridad</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={priorityBars} layout="vertical" margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_DEFAULTS.gridColor} horizontal={false} />
            <XAxis type="number" tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }} tickLine={false} axisLine={false} width={50} />
            <Tooltip contentStyle={CHART_DEFAULTS.tooltipStyle} />
            <Bar dataKey="count" radius={[0, 3, 3, 0]} name="Incidentes">
              {priorityBars.map((b, i) => <Cell key={i} fill={b.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Despacho por unidad */}
      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Despacho por unidad (min)</p>
        <div className="flex flex-col gap-2 mt-1">
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
