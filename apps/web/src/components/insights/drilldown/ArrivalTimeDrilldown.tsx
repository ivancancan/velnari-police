'use client';

import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import type { AnalyticsResult } from '@/lib/types';
import { CHART_COLORS, CHART_DEFAULTS } from '../chartTheme';

export default function ArrivalTimeDrilldown({ data }: { data: AnalyticsResult }) {
  const byDayData = data.byDay.map((d) => ({
    date: new Date(d.date).toLocaleDateString('es-MX', { weekday: 'short' }),
    count: d.count,
  }));

  const unitBars = data.byUnit.slice(0, 6).sort((a, b) => b.count - a.count);

  return (
    <div className="grid grid-cols-2 gap-6">
      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Incidentes por día</p>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={byDayData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_DEFAULTS.gridColor} />
            <XAxis dataKey="date" tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={CHART_DEFAULTS.tooltipStyle} />
            <Line type="monotone" dataKey="count" stroke={CHART_COLORS.blue} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.blue }} name="Incidentes" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Incidentes por unidad</p>
        <div className="flex flex-col gap-2">
          {unitBars.map((u) => {
            const max = unitBars[0]?.count ?? 1;
            return (
              <div key={u.unitId} className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-signal-white w-10 shrink-0">{u.callSign}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                  <div className="h-full rounded-full bg-tactical-blue" style={{ width: `${(u.count / max) * 100}%` }} />
                </div>
                <span className="text-[10px] text-slate-400 w-6 text-right">{u.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
