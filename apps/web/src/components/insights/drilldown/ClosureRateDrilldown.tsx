'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { AnalyticsResult } from '@/lib/types';
import { CHART_COLORS, CHART_DEFAULTS } from '../chartTheme';

export default function ClosureRateDrilldown({ data }: { data: AnalyticsResult }) {
  const statusData = Object.entries(data.byStatus).map(([status, count]) => ({
    name: status === 'open' ? 'Abierto' : status === 'closed' ? 'Cerrado' : status === 'assigned' ? 'Asignado' : status,
    count,
    color: status === 'closed' ? CHART_COLORS.green : status === 'open' ? CHART_COLORS.red : CHART_COLORS.amber,
  }));

  const byDay = data.byDay.map((d) => ({
    date: new Date(d.date).toLocaleDateString('es-MX', { weekday: 'short' }),
    total: d.count,
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
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Total por día</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={byDay} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_DEFAULTS.gridColor} />
            <XAxis dataKey="date" tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={CHART_DEFAULTS.tooltipStyle} />
            <Bar dataKey="total" fill={CHART_COLORS.amber} radius={[3, 3, 0, 0]} name="Total" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
