'use client';

import { useEffect, useState, useMemo } from 'react';
import { incidentsApi } from '@/lib/api';
import { reportError } from '@/lib/report-error';

// 7×24 heatmap of incident density by day-of-week × hour-of-day, computed
// in Mexico City time. Hovering a cell shows the count and the most
// frequent incident type. Answers "when/where do I need more patrols?".

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const TYPE_LABEL: Record<string, string> = {
  robbery: 'Robos',
  assault: 'Agresiones',
  traffic: 'Tráfico',
  noise: 'Ruido',
  domestic: 'Doméstico',
  missing_person: 'Desaparecidos',
  other: 'Otro',
};

interface Props {
  days?: number;
}

export default function PatternHeatmap({ days = 90 }: Props) {
  const [cells, setCells] = useState<{ dayOfWeek: number; hour: number; count: number }[]>(
    [],
  );
  const [topType, setTopType] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    incidentsApi
      .getTimeOfDayPatterns(days)
      .then((res) => {
        setCells(res.data.cells);
        setTopType(res.data.topTypeByCell);
      })
      .catch((err) => reportError(err, { tag: 'dashboard.patterns' }))
      .finally(() => setLoading(false));
  }, [days]);

  const { matrix, maxCount } = useMemo(() => {
    const m: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;
    for (const c of cells) {
      if (m[c.dayOfWeek]) {
        m[c.dayOfWeek]![c.hour] = c.count;
        if (c.count > max) max = c.count;
      }
    }
    return { matrix: m, maxCount: max };
  }, [cells]);

  // Top 3 "hotspots" for the textual recommendation.
  const hotspots = useMemo(() => {
    return [...cells]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((c) => ({
        ...c,
        type: topType[`${c.dayOfWeek}-${c.hour}`] ?? 'other',
      }));
  }, [cells, topType]);

  function cellColor(count: number): string {
    if (maxCount === 0 || count === 0) return 'bg-slate-900';
    const intensity = count / maxCount;
    if (intensity > 0.75) return 'bg-red-500';
    if (intensity > 0.5) return 'bg-orange-500';
    if (intensity > 0.25) return 'bg-amber-500';
    if (intensity > 0.1) return 'bg-yellow-600';
    return 'bg-slate-700';
  }

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse h-64" />
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-signal-white">
            Patrones por día y hora
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Últimos {days} días — zona horaria Ciudad de México
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <span>menos</span>
          <span className="w-3 h-3 bg-slate-700 rounded-sm" />
          <span className="w-3 h-3 bg-yellow-600 rounded-sm" />
          <span className="w-3 h-3 bg-amber-500 rounded-sm" />
          <span className="w-3 h-3 bg-orange-500 rounded-sm" />
          <span className="w-3 h-3 bg-red-500 rounded-sm" />
          <span>más</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Hour header */}
          <div className="flex gap-px ml-10 mb-1">
            {Array.from({ length: 24 }).map((_, h) => (
              <div
                key={h}
                className="w-3 h-3 text-[8px] text-slate-600 text-center font-mono leading-3"
              >
                {h % 3 === 0 ? h : ''}
              </div>
            ))}
          </div>
          {/* Rows */}
          {DAYS.map((label, d) => (
            <div key={d} className="flex gap-px items-center mb-px">
              <span className="w-10 text-[10px] text-slate-400 font-semibold">
                {label}
              </span>
              {Array.from({ length: 24 }).map((_, h) => {
                const count = matrix[d]?.[h] ?? 0;
                const tipType = topType[`${d}-${h}`];
                return (
                  <div
                    key={h}
                    className={`w-3 h-3 rounded-sm transition-colors ${cellColor(count)}`}
                    title={`${label} ${String(h).padStart(2, '0')}:00 · ${count} incidente${
                      count === 1 ? '' : 's'
                    }${tipType ? ` · más frecuente: ${TYPE_LABEL[tipType] ?? tipType}` : ''}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {hotspots.length > 0 && (
        <div className="mt-4 text-xs text-slate-400 space-y-1">
          <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
            Top 3 ventanas de alto volumen
          </p>
          {hotspots.map((h, i) => (
            <p key={i} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span>
                <strong className="text-signal-white">{DAYS[h.dayOfWeek]}</strong>{' '}
                {String(h.hour).padStart(2, '0')}:00 — {h.count} incidentes, mayormente{' '}
                <span className="text-amber-300">{TYPE_LABEL[h.type] ?? h.type}</span>
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
