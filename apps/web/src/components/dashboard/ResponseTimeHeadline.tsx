// apps/web/src/components/dashboard/ResponseTimeHeadline.tsx
import type { DailySummary } from '@/lib/types';

interface Props {
  dailySummary: DailySummary;
}

export default function ResponseTimeHeadline({ dailySummary }: Props) {
  const avg = dailySummary.avgResponseMinutes;
  const delta = dailySummary.comparedToYesterday?.responseTime;

  const hasDelta = delta != null && avg != null;
  const improved = hasDelta && delta <= 0;
  const pct = hasDelta && delta !== 0
    ? Math.abs(Math.round((delta / (avg - delta)) * 100))
    : null;

  const trendColor = !hasDelta
    ? 'text-slate-gray'
    : improved
      ? 'text-green-400'
      : 'text-red-400';

  const trendBg = !hasDelta
    ? 'bg-slate-800'
    : improved
      ? 'bg-green-950/60 border border-green-800/50'
      : 'bg-red-950/60 border border-red-800/50';

  const trendLabel = !hasDelta
    ? null
    : improved && delta === 0
      ? 'Sin cambio vs ayer'
      : improved
        ? `${pct}% más rápido que ayer`
        : `${pct}% más lento que ayer`;

  return (
    <section className="mb-8">
      <h2 className="text-xs text-slate-gray uppercase tracking-widest mb-3 font-semibold">
        Tiempo de Respuesta
      </h2>
      <div className={`rounded-xl p-6 flex flex-col md:flex-row md:items-center gap-4 ${trendBg || 'bg-slate-800'}`}>
        <div className="flex items-end gap-3">
          <span className={`text-6xl font-bold font-mono ${trendColor}`}>
            {avg != null ? avg : '—'}
          </span>
          {avg != null && (
            <span className="text-slate-gray text-lg pb-2">min</span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-signal-white font-semibold text-lg">
            Promedio hoy
          </p>
          {trendLabel && (
            <p className={`text-sm font-medium ${trendColor}`}>
              {improved ? '↑' : '↓'} {trendLabel}
            </p>
          )}
          {!hasDelta && (
            <p className="text-slate-gray text-sm">Sin datos de ayer para comparar</p>
          )}
          <p className="text-slate-500 text-xs mt-1">Meta: &lt; 2 min</p>
        </div>

        {avg != null && (
          <div className="md:ml-auto flex flex-col items-center md:items-end gap-1">
            <div
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                avg <= 2
                  ? 'bg-green-900 text-green-300'
                  : avg <= 5
                    ? 'bg-amber-900 text-amber-300'
                    : 'bg-red-900 text-red-300'
              }`}
            >
              {avg <= 2 ? '✓ Meta cumplida' : avg <= 5 ? '⚠ Cerca de la meta' : '✕ Fuera de meta'}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
