'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import DateRangeSelector, { presetToRange } from '@/components/insights/DateRangeSelector';
import KpiGrid from '@/components/insights/KpiGrid';
import ExportBar from '@/components/insights/ExportBar';
import { useInsightsData } from '@/hooks/useInsightsData';
import type { DateRange } from '@/hooks/useInsightsData';

type Preset = 'today' | 'week' | 'month' | 'quarter' | 'custom';

export default function InsightsPage() {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();

  const isSupervisor = user?.role === 'supervisor';
  const isAdmin = user?.role === 'admin' || user?.role === 'commander';

  const [activePreset, setActivePreset] = useState<Preset>('week');
  const [range, setRange] = useState<DateRange>(presetToRange('week'));

  const data = useInsightsData(isSupervisor ? presetToRange('today') : range);

  return (
    <div className="min-h-screen bg-midnight-command flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/50 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/command')}
            className="text-slate-400 hover:text-signal-white transition-colors text-sm"
            aria-label="Volver al mapa"
          >
            ←
          </button>
          <div>
            <h1 className="text-sm font-bold text-signal-white tracking-tight">📊 Velnari Insights</h1>
            <p className="text-[10px] text-slate-500">Analítica operativa · acumulado por período</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <DateRangeSelector
            range={range}
            onChange={setRange}
            activePreset={activePreset}
            onPresetChange={setActivePreset}
            supervisorLocked={isSupervisor}
          />
          <span className="text-[10px] bg-slate-800 border border-slate-700 px-2 py-1 rounded-lg text-slate-400">
            {user?.role}
          </span>
          <button
            onClick={() => { clearAuth(); router.push('/login'); }}
            className="text-slate-500 hover:text-red-400 text-xs transition-colors"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Loading */}
      {data.loading && (
        <div className="flex items-center justify-center flex-1">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-tactical-blue border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Cargando métricas…</p>
          </div>
        </div>
      )}

      {/* Error */}
      {data.error && !data.loading && (
        <div className="flex items-center justify-center flex-1">
          <p className="text-red-400 text-sm">Error: {data.error}</p>
        </div>
      )}

      {/* Content */}
      {!data.loading && !data.error && (
        <div className="flex-1 overflow-y-auto">
          <KpiGrid data={data} />
          {isAdmin && <ExportBar range={isSupervisor ? presetToRange('today') : range} />}
        </div>
      )}
    </div>
  );
}
