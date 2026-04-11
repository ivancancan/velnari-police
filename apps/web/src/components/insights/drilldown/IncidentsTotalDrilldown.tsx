'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import type { AnalyticsResult } from '@/lib/types';
import { CHART_COLORS, PRIORITY_COLORS, PRIORITY_LABELS, TYPE_LABELS, CHART_DEFAULTS } from '../chartTheme';

export default function IncidentsTotalDrilldown({ data }: { data: AnalyticsResult }) {
  const byDayData = data.byDay.map((d) => ({
    date: new Date(d.date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
    count: d.count,
  }));

  const byPriorityData = ['critical', 'high', 'medium', 'low'].map((p) => ({
    name: PRIORITY_LABELS[p] ?? p,
    value: data.byPriority[p] ?? 0,
    color: PRIORITY_COLORS[p] ?? CHART_COLORS.slate,
  })).filter((d) => d.value > 0);

  const byTypeData = Object.entries(data.byType)
    .map(([type, count]) => ({ name: TYPE_LABELS[type] ?? type, value: count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div className="grid grid-cols-3 gap-6">
      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Incidentes por día</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={byDayData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_DEFAULTS.gridColor} />
            <XAxis dataKey="date" tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={CHART_DEFAULTS.tooltipStyle} />
            <Bar dataKey="count" fill={CHART_COLORS.blue} radius={[3, 3, 0, 0]} name="Incidentes" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Por prioridad</p>
        <div className="flex items-center gap-4">
          <PieChart width={100} height={100}>
            <Pie data={byPriorityData} cx={45} cy={45} innerRadius={28} outerRadius={45} dataKey="value" paddingAngle={2}>
              {byPriorityData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
          </PieChart>
          <div className="flex flex-col gap-1.5">
            {byPriorityData.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-[10px] text-slate-300">{d.name} — {d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Por tipo (top 5)</p>
        <div className="flex flex-col gap-2">
          {byTypeData.map((d) => {
            const max = byTypeData[0]?.value ?? 1;
            return (
              <div key={d.name} className="flex items-center gap-2">
                <span className="text-[10px] text-slate-300 w-20 truncate shrink-0">{d.name}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                  <div className="h-full rounded-full bg-tactical-blue" style={{ width: `${(d.value / max) * 100}%` }} />
                </div>
                <span className="text-[10px] text-slate-400 w-6 text-right">{d.value}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
