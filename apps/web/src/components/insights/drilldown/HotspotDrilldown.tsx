'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { AnalyticsResult } from '@/lib/types';
import { CHART_COLORS, CHART_DEFAULTS } from '../chartTheme';

export default function HotspotDrilldown({ data }: { data: AnalyticsResult }) {
  const sectorData = data.bySector.slice().sort((a, b) => b.count - a.count);

  const hourMax = Math.max(...data.byHour.map((h) => h.count), 1);
  const hours = Array.from({ length: 24 }, (_, i) => {
    const h = data.byHour.find((x) => x.hour === i);
    return { hour: i, count: h?.count ?? 0 };
  });

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Sectores */}
      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Incidentes por sector</p>
        {sectorData.length === 0 ? (
          <p className="text-slate-500 text-xs">Sin datos de sector</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={sectorData} layout="vertical" margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_DEFAULTS.gridColor} horizontal={false} />
              <XAxis type="number" tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="sectorName" tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }} tickLine={false} axisLine={false} width={90} />
              <Tooltip contentStyle={CHART_DEFAULTS.tooltipStyle} />
              <Bar dataKey="count" fill={CHART_COLORS.amber} radius={[0, 3, 3, 0]} name="Incidentes" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Heatmap por hora */}
      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Incidentes por hora del día</p>
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
          {hours.map(({ hour, count }) => {
            const intensity = count / hourMax;
            return (
              <div key={hour} className="flex flex-col items-center gap-0.5">
                <div
                  title={`${String(hour).padStart(2, '0')}:00 — ${count} incidentes`}
                  className="w-full rounded-sm cursor-default"
                  style={{
                    height: 28,
                    backgroundColor: intensity > 0
                      ? `rgba(239,68,68,${Math.max(intensity * 0.9, 0.15)})`
                      : '#1e293b',
                  }}
                />
                {hour % 6 === 0 && (
                  <span className="text-[8px] text-slate-600">{String(hour).padStart(2, '0')}h</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
              <div key={v} className="w-4 h-2 rounded-sm" style={{ backgroundColor: `rgba(239,68,68,${v})` }} />
            ))}
          </div>
          <span className="text-[9px] text-slate-500">menos → más actividad</span>
        </div>
      </div>
    </div>
  );
}
