'use client';

import { useEffect, useState } from 'react';
import { patrolsApi } from '@/lib/api';
import type { Patrol } from '@/lib/types';
import { CHART_COLORS } from '../chartTheme';

export default function PatrolCoverageDrilldown() {
  const [patrols, setPatrols] = useState<Patrol[]>([]);

  useEffect(() => {
    patrolsApi.getActive().then((r) => setPatrols(r.data as Patrol[])).catch(() => {});
  }, []);

  const completed = patrols.filter((p) => p.status === 'completed').length;
  const total = patrols.length;

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Patrullajes recientes</p>
        <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
          {patrols.length === 0 && <p className="text-slate-500 text-xs">Sin datos de patrullaje</p>}
          {patrols.slice(0, 8).map((p) => (
            <div key={p.id} className="flex items-center gap-2 bg-slate-900/50 rounded-lg px-2.5 py-1.5">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: p.status === 'completed' ? CHART_COLORS.green : p.status === 'active' ? CHART_COLORS.blue : CHART_COLORS.slate }}
              />
              <span className="text-[10px] text-slate-300 flex-1 truncate">{p.status}</span>
              <span className="text-[9px] text-slate-500 shrink-0">
                {p.startAt ? new Date(p.startAt).toLocaleDateString('es-MX') : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center bg-slate-900/50 rounded-xl border border-slate-700">
        <span className="text-4xl font-bold font-mono text-green-400">
          {total > 0 ? Math.round((completed / total) * 100) : 0}%
        </span>
        <span className="text-xs text-slate-400 mt-1">Patrullajes completados</span>
        <span className="text-[10px] text-slate-600 mt-1">{completed} de {total} turnos</span>
      </div>
    </div>
  );
}
