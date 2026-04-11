'use client';

import type { AnalyticsResult } from '@/lib/types';
import { CHART_COLORS } from '../chartTheme';

export default function BestUnitDrilldown({ data }: { data: AnalyticsResult }) {
  const ranked = data.byUnit.slice().sort((a, b) => {
    // scoring: prioritize volume then speed
    const scoreA = a.count * 10 - (a.avgResponseMin ?? 99);
    const scoreB = b.count * 10 - (b.avgResponseMin ?? 99);
    return scoreB - scoreA;
  });
  const maxCount = ranked[0]?.count ?? 1;

  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Ranking de unidades — incidentes atendidos</p>
      <div className="flex flex-col gap-2">
        {ranked.map((u, i) => (
          <div key={u.unitId} className="flex items-center gap-3 bg-slate-900/40 rounded-lg px-3 py-2">
            <span className="text-[11px] text-slate-500 w-4 text-right shrink-0">#{i + 1}</span>
            <span className="font-mono text-xs font-bold text-signal-white w-10 shrink-0">{u.callSign}</span>
            <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(u.count / maxCount) * 100}%`,
                  backgroundColor: i === 0 ? CHART_COLORS.amber : CHART_COLORS.blue,
                }}
              />
            </div>
            <span className="text-[10px] text-slate-300 w-16 text-right shrink-0">
              {u.count} inc{u.avgResponseMin != null ? ` · ${u.avgResponseMin.toFixed(1)}m` : ''}
            </span>
            {i === 0 && <span className="text-sm">🏆</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
