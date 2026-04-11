'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { AnalyticsResult } from '@/lib/types';
import { CHART_COLORS, CHART_DEFAULTS } from '../chartTheme';

export default function CriticalsDrilldown({ data }: { data: AnalyticsResult }) {
  const criticals = data.incidents
    .filter((i) => i.priority === 'critical')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  const byDay = data.byDay.map((d) => ({
    date: new Date(d.date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
    count: d.count,
  }));

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Lista de incidentes críticos recientes */}
      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">
          Críticos recientes ({data.byPriority['critical'] ?? 0} total)
        </p>
        <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
          {criticals.length === 0 && (
            <p className="text-slate-500 text-xs">Sin incidentes críticos en el período</p>
          )}
          {criticals.map((inc) => (
            <div key={inc.id} className="flex items-center gap-2 bg-slate-900/60 rounded-lg px-2.5 py-2 border border-red-900/20">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span className="text-[10px] font-mono text-red-400 shrink-0 w-14">{inc.folio}</span>
              <span className="text-[10px] text-slate-300 truncate flex-1">{inc.address ?? '—'}</span>
              <span className="text-[9px] text-slate-500 shrink-0">
                {new Date(inc.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Barras por día */}
      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Total incidentes por día</p>
        <ResponsiveContainer width="100%" height={160}>
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
