'use client';

import type { UnitStats } from '@/lib/types';
import { CHART_COLORS } from '../chartTheme';

const STATUS_CONFIG = [
  { key: 'available',    label: 'Disponible',        color: CHART_COLORS.green  },
  { key: 'enRoute',      label: 'En ruta',           color: CHART_COLORS.blue   },
  { key: 'onScene',      label: 'En escena',         color: CHART_COLORS.amber  },
  { key: 'outOfService', label: 'Fuera de servicio', color: CHART_COLORS.slate  },
] as const;

export default function UnitsActiveDrilldown({ stats }: { stats: UnitStats }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Estado actual de la flota</p>
        <div className="flex gap-2 mb-4">
          {STATUS_CONFIG.map(({ key, color }) => (
            <div
              key={key}
              className="w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold font-mono"
              style={{ backgroundColor: `${color}33`, borderColor: color, color }}
            >
              {(stats as Record<string, number>)[key] ?? 0}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {STATUS_CONFIG.map(({ key, label, color }) => (
            <div key={key} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[11px] text-slate-300 flex-1">{label}</span>
              <span className="text-[11px] font-mono text-signal-white">{(stats as Record<string, number>)[key] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center bg-slate-900/50 rounded-xl border border-slate-700">
        <span className="text-4xl font-bold font-mono text-green-400">
          {stats.total > 0 ? Math.round(((stats.available + stats.enRoute + stats.onScene) / stats.total) * 100) : 0}%
        </span>
        <span className="text-xs text-slate-400 mt-1">Adopción digital</span>
        <span className="text-[10px] text-slate-600 mt-1">{stats.available + stats.enRoute + stats.onScene} de {stats.total} unidades</span>
      </div>
    </div>
  );
}
