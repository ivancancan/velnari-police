'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { AnalyticsResult } from '@/lib/types';
import { CHART_COLORS, CHART_DEFAULTS } from '../chartTheme';

export default function CriticalsDrilldown({ data }: { data: AnalyticsResult }) {
  const byDay = data.byDay.map((d) => ({
    date: new Date(d.date).toLocaleDateString('es-MX', { weekday: 'short' }),
    count: d.count,
  }));

  const criticalCount = data.byPriority['critical'] ?? 0;

  return (
    <div className="grid grid-cols-2 gap-6">
      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Resumen críticos</p>
        <div className="flex flex-col items-center justify-center h-28 bg-slate-900/50 rounded-xl border border-red-900/40">
          <span className="text-4xl font-bold font-mono text-red-400">{criticalCount}</span>
          <span className="text-xs text-slate-400 mt-1">Incidentes críticos</span>
          <span className="text-[10px] text-slate-600 mt-1">en el período seleccionado</span>
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Incidentes por día</p>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={byDay} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_DEFAULTS.gridColor} />
            <XAxis dataKey="date" tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={CHART_DEFAULTS.tooltipStyle} />
            <Bar dataKey="count" fill={CHART_COLORS.red} radius={[3, 3, 0, 0]} name="Incidentes" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
