'use client';

// Public transparency portal — no auth required. Shows anonymized aggregate
// data so citizens can see incident activity, response times, and closure
// rates. Coordinates are server-rounded to ~100m to prevent de-anonymization
// of individual reporters. Intended as a political/trust asset for the
// municipality ("Velnari makes your security data auditable in real time").

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { reportError } from '@/lib/report-error';

const TransparencyMap = dynamic(() => import('@/components/transparencia/TransparencyMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 md:h-[420px] rounded-xl bg-slate-900 animate-pulse" />
  ),
});

interface TransparencyData {
  windowDays: number;
  totals: { incidents: number; closed: number; inProgress: number };
  byPriority: Record<string, number>;
  byType: Record<string, number>;
  avgResponseMinutes: number | null;
  points: {
    lat: number;
    lng: number;
    type: string;
    priority: string;
    createdAt: string;
    status: string;
  }[];
}

const TYPE_LABELS: Record<string, string> = {
  robbery: 'Robo',
  assault: 'Agresión',
  traffic: 'Tráfico',
  noise: 'Ruido',
  domestic: 'Violencia doméstica',
  missing_person: 'Persona desaparecida',
  other: 'Otro',
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-green-500',
};

export default function TransparencyPage() {
  const [data, setData] = useState<TransparencyData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<TransparencyData>(`/incidents/transparency?days=${days}`)
      .then((res) => setData(res.data))
      .catch((err) => reportError(err, { tag: 'transparency.load' }))
      .finally(() => setLoading(false));
  }, [days]);

  const closureRate =
    data && data.totals.incidents > 0
      ? Math.round((data.totals.closed / data.totals.incidents) * 100)
      : null;

  return (
    <div className="min-h-screen bg-midnight-command text-signal-white">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-tactical-blue to-blue-700 flex items-center justify-center font-bold">
              V
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Portal de Transparencia
              </h1>
              <p className="text-xs text-slate-400">
                Datos operativos en vivo — actualizado cada hora
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-400 max-w-2xl leading-relaxed">
            Esta página muestra información agregada y anonimizada sobre la
            actividad operativa reciente. Las ubicaciones están aproximadas
            a un radio de ~100m para proteger la privacidad de quienes reportan.
          </p>

          {/* Window selector */}
          <div className="mt-6 inline-flex rounded-lg border border-slate-700 overflow-hidden text-xs font-semibold">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-4 py-1.5 transition-colors ${
                  days === d
                    ? 'bg-tactical-blue text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-signal-white'
                }`}
              >
                Últimos {d} días
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {loading || !data ? (
            [0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-slate-900 border border-slate-800 rounded-lg p-5 animate-pulse h-28"
              />
            ))
          ) : (
            <>
              <KpiCard
                label="Incidentes"
                value={data.totals.incidents}
                sub={`Últimos ${data.windowDays} días`}
              />
              <KpiCard
                label="Resueltos"
                value={data.totals.closed}
                sub={closureRate != null ? `${closureRate}% del total` : ''}
                color="green"
              />
              <KpiCard
                label="En proceso"
                value={data.totals.inProgress}
                sub="Activos al corte"
                color="amber"
              />
              <KpiCard
                label="Respuesta"
                value={data.avgResponseMinutes ?? '—'}
                sub={data.avgResponseMinutes != null ? 'minutos promedio' : 'Sin datos'}
                color="blue"
              />
            </>
          )}
        </section>

        {/* Map */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-slate-400 mb-3 font-semibold">
            Mapa de incidentes (anonimizado)
          </h2>
          <TransparencyMap points={data?.points ?? []} />
        </section>

        {/* Breakdown */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xs uppercase tracking-widest text-slate-400 mb-3 font-semibold">
              Por prioridad
            </h2>
            <div className="space-y-2">
              {data &&
                Object.entries(data.byPriority)
                  .sort(([, a], [, b]) => b - a)
                  .map(([priority, count]) => {
                    const pct =
                      data.totals.incidents > 0
                        ? (count / data.totals.incidents) * 100
                        : 0;
                    return (
                      <div key={priority}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>{PRIORITY_LABELS[priority] ?? priority}</span>
                          <span className="font-mono text-slate-400">
                            {count} · {Math.round(pct)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full ${PRIORITY_COLORS[priority] ?? 'bg-slate-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>

          <div>
            <h2 className="text-xs uppercase tracking-widest text-slate-400 mb-3 font-semibold">
              Por tipo de incidente
            </h2>
            <div className="space-y-2">
              {data &&
                Object.entries(data.byType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => {
                    const pct =
                      data.totals.incidents > 0
                        ? (count / data.totals.incidents) * 100
                        : 0;
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>{TYPE_LABELS[type] ?? type}</span>
                          <span className="font-mono text-slate-400">
                            {count} · {Math.round(pct)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-tactical-blue"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
        </section>

        {/* Footer notice */}
        <footer className="pt-8 border-t border-slate-800 text-xs text-slate-500 space-y-2">
          <p>
            <strong>Metodología:</strong> Datos operativos directos desde el
            sistema Velnari utilizado por la policía municipal. Ubicaciones
            redondeadas a 3 decimales (~100m). Registros mayores a 90 días
            no se exponen.
          </p>
          <p>
            <strong>Derechos:</strong> Si tu reporte está contenido en este
            conjunto y deseas ejercer derechos ARCO (acceso, rectificación,
            cancelación, oposición), escribe a{' '}
            <a
              className="text-tactical-blue underline"
              href="mailto:privacidad@velnari.mx"
            >
              privacidad@velnari.mx
            </a>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  color = 'slate',
}: {
  label: string;
  value: string | number;
  sub: string;
  color?: 'slate' | 'green' | 'amber' | 'blue';
}) {
  const colorClass =
    color === 'green'
      ? 'text-green-400'
      : color === 'amber'
      ? 'text-amber-400'
      : color === 'blue'
      ? 'text-tactical-blue'
      : 'text-signal-white';
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
      <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">
        {label}
      </p>
      <p className={`text-3xl font-bold font-mono ${colorClass}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}
