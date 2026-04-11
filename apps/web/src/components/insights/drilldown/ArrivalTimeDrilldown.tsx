'use client';

import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import type { AnalyticsResult } from '@/lib/types';
import { CHART_COLORS, CHART_DEFAULTS } from '../chartTheme';

interface Props {
  data: AnalyticsResult;
  prevData?: AnalyticsResult | null;
}

function fmtDate(dateStr: string, totalDays: number) {
  const d = new Date(dateStr);
  if (totalDays <= 7) return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

export default function ArrivalTimeDrilldown({ data, prevData }: Props) {
  const totalDays = data.byDay.length;
  const tickInterval = totalDays <= 7 ? 0 : totalDays <= 14 ? 1 : Math.floor(totalDays / 7);

  const byDayData = data.byDay.map((d, i) => ({
    date: fmtDate(d.date, totalDays),
    actual: d.count,
    anterior: prevData?.byDay[i]?.count ?? null,
  }));

  const unitBars = data.byUnit.slice(0, 6).sort((a, b) => b.count - a.count);

  return (
    <div className="grid grid-cols-2 gap-6">
      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">
          Incidentes por día {prevData ? '(vs período anterior)' : ''}
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={byDayData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_DEFAULTS.gridColor} />
            <XAxis dataKey="date" tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 9 }} tickLine={false} interval={tickInterval} />
            <YAxis tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={CHART_DEFAULTS.tooltipStyle} />
            {prevData && (
              <Line type="monotone" dataKey="anterior" stroke={CHART_COLORS.slate} strokeWidth={1.5}
                strokeDasharray="4 2" dot={false} name="Anterior" connectNulls />
            )}
            <Line type="monotone" dataKey="actual" stroke={CHART_COLORS.blue} strokeWidth={2}
              dot={totalDays <= 7 ? { fill: CHART_COLORS.blue, r: 3 } : false} name="Actual" />
            {prevData && <Legend wrapperStyle={{ fontSize: 9, color: CHART_DEFAULTS.tickColor }} />}
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
