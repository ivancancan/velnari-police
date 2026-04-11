'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { AnalyticsResult } from '@/lib/types';
import { CHART_COLORS, CHART_DEFAULTS } from '../chartTheme';

export default function HotspotDrilldown({ data }: { data: AnalyticsResult }) {
  const sectorData = data.bySector.slice().sort((a, b) => b.count - a.count);
  const maxHourCount = Math.max(...data.byHour.map((h) => h.count), 1);

  return (
    <div className="grid grid-cols-2 gap-6">
      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Incidentes por sector</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={sectorData} layout="vertical" margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_DEFAULTS.gridColor} horizontal={false} />
            <XAxis type="number" tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="sectorName" tick={{ fill: CHART_DEFAULTS.tickColor, fontSize: 10 }} tickLine={false} axisLine={false} width={70} />
            <Tooltip contentStyle={CHART_DEFAULTS.tooltipStyle} />
            <Bar dataKey="count" fill={CHART_COLORS.amber} radius={[0, 3, 3, 0]} name="Incidentes" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ minWidth: 0 }}>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Incidentes por hora del día</p>
        <div className="grid grid-cols-12 gap-0.5">
          {Array.from({ length: 24 }, (_, h) => {
            const entry = data.byHour.find((b) => b.hour === h);
            const count = entry?.count ?? 0;
            const intensity = count / maxHourCount;
            return (
              <div
                key={h}
                title={`${h}:00 — ${count} inc.`}
                className="rounded-sm"
                style={{
                  height: 28,
                  backgroundColor: count === 0
                    ? '#1e293b'
                    : `rgba(245, 158, 11, ${0.15 + intensity * 0.85})`,
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-slate-600">0h</span>
          <span className="text-[9px] text-slate-600">12h</span>
          <span className="text-[9px] text-slate-600">23h</span>
        </div>
      </div>
    </div>
  );
}
