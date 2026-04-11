'use client';

import type { SlaCompliance } from '@/lib/types';
import { PRIORITY_LABELS, PRIORITY_COLORS, CHART_COLORS } from '../chartTheme';

export default function SlaDrilldown({ sla }: { sla: SlaCompliance }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Cumplimiento por prioridad</p>
        <div className="flex flex-col gap-3">
          {sla.byPriority.map((row) => (
            <div key={String(row.priority)}>
              <div className="flex justify-between mb-1">
                <span className="text-[11px] text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: PRIORITY_COLORS[String(row.priority)] ?? CHART_COLORS.slate }} />
                  {PRIORITY_LABELS[String(row.priority)] ?? String(row.priority)}
                </span>
                <span className="text-[11px] font-mono" style={{ color: row.compliancePct >= 85 ? CHART_COLORS.green : CHART_COLORS.red }}>
                  {row.compliancePct}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${row.compliancePct}%`,
                    backgroundColor: row.compliancePct >= 85 ? CHART_COLORS.green : CHART_COLORS.red,
                  }}
                />
              </div>
              <p className="text-[9px] text-slate-600 mt-0.5">{row.compliantCount}/{row.totalCount} en tiempo · meta {row.targetMinutes} min</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Resumen global</p>
        <div className="flex flex-col items-center justify-center h-28 bg-slate-900/50 rounded-xl border border-slate-700">
          <span className="text-4xl font-bold font-mono" style={{ color: sla.overallPct >= 85 ? CHART_COLORS.green : CHART_COLORS.red }}>
            {sla.overallPct}%
          </span>
          <span className="text-xs text-slate-400 mt-1">SLA global cumplido</span>
          <span className="text-[10px] text-slate-600 mt-1">Meta: 85%</span>
        </div>
      </div>
    </div>
  );
}
