'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Legend } from 'recharts';
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

export default function ClosureRateDrilldown({ data, prevData }: Props) {
  const totalDays = data.byDay.length;
  const tickInterval = totalDays <= 7 ? 0 : totalDays <= 14 ? 1 : Math.floor(totalDays / 7);

  const statusData = Object.entries(data.byStatus).map(([status, count]) => ({
    name: status === 'open' ? 'Abierto' : status === 'closed' ? 'Cerrado' : status === 'assigned' ? 'Asignado' : status,
    count,
    color: status === 'closed' ? CHART_COLORS.green : status === 'open' ? CHART_COLORS.red : CHART_COLORS.amber,
  }));

  const byDay = data.byDay.map((d, i) => ({
    date: fmtDate(d.date, totalDays),
    actual: d.count,
    anterior: prevData?.byDay[i]?.count ?? null,
  }));

  return (
    <div className="grid grid-cols-2 gap-6">
      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Distribución por estado</p>
        <div className="flex flex-col gap-3">
          {statusData.map((s) => (
            <div key={s.name}>
              <div className="flex justify-between mb-1">
                <span className="text-[11px] text-slate-300">{s.name}</span>
                <span className="text-[11px] font-mono" style={{ color: s.color }}>{s.count}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(s.count / (data.summary.totalIncidents || 1)) * 100}%`, backgroundColor: s.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">
          Total por día {prevData ? '(vs período anterior)' : ''}
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={byDay} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_DEFAULTS.gridColor} />
            <XAxis dataKey="date" tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 9 }} tickLine={false} interval={tickInterval} />
            <YAxis tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={CHART_DEFAULTS.tooltipStyle} />
            {prevData && (
              <Line type="monotone" dataKey="anterior" stroke={CHART_COLORS.slate} strokeWidth={1.5}
                strokeDasharray="4 2" dot={false} name="Anterior" connectNulls />
            )}
            <Line type="monotone" dataKey="actual" stroke={CHART_COLORS.amber} strokeWidth={2}
              dot={totalDays <= 7 ? { fill: CHART_COLORS.amber, r: 3 } : false} name="Actual" />
            {prevData && <Legend wrapperStyle={{ fontSize: 9, color: CHART_DEFAULTS.tickColor }} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
