'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { incidentsApi, unitsApi } from '@/lib/api';
import type { IncidentStats, UnitStats, Incident } from '@/lib/types';
import StatsCard from '@/components/dashboard/StatsCard';
import MiniBarChart from '@/components/dashboard/MiniBarChart';

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#22C55E',
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
};

const TYPE_LABELS: Record<string, string> = {
  robbery: 'Robo',
  assault: 'Agresión',
  traffic: 'Tráfico',
  noise: 'Ruido',
  domestic: 'Doméstico',
  missing_person: 'Extraviado',
  other: 'Otro',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  open: { label: 'Abierto', className: 'bg-red-900 text-red-300' },
  assigned: { label: 'Asignado', className: 'bg-blue-900 text-blue-300' },
  en_route: { label: 'En Ruta', className: 'bg-amber-900 text-amber-300' },
  on_scene: { label: 'En Escena', className: 'bg-amber-900 text-amber-300' },
  closed: { label: 'Cerrado', className: 'bg-slate-700 text-slate-300' },
};

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const { isAuthenticated, user, clearAuth } = useAuthStore();
  const router = useRouter();
  const [date, setDate] = useState(toDateString(new Date()));
  const [incidentStats, setIncidentStats] = useState<IncidentStats | null>(null);
  const [unitStats, setUnitStats] = useState<UnitStats | null>(null);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      incidentsApi.getStats(date),
      unitsApi.getStats(),
      incidentsApi.getAll(),
    ])
      .then(([statsRes, unitStatsRes, incidentsRes]) => {
        setIncidentStats(statsRes.data);
        setUnitStats(unitStatsRes.data);
        const forDate = incidentsRes.data
          .filter((i) => i.createdAt.startsWith(date))
          .slice(0, 15);
        setRecentIncidents(forDate);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex flex-col min-h-screen bg-midnight-command">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-6">
          <span className="font-bold text-signal-white tracking-tight">Velnari Insights</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/command" className="text-slate-gray hover:text-signal-white transition-colors">
              Mapa
            </Link>
            <span className="text-signal-white font-medium border-b-2 border-tactical-blue pb-0.5">
              Dashboard
            </span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={date}
            max={toDateString(new Date())}
            onChange={(e) => setDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-signal-white text-xs focus:outline-none focus:border-tactical-blue"
            aria-label="Fecha del reporte"
          />
          <span className="text-sm text-slate-gray">{user?.name}</span>
          <button
            onClick={clearAuth}
            className="text-xs text-slate-gray hover:text-signal-white transition-colors"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-6 max-w-6xl mx-auto w-full">
        {loading && !incidentStats && (
          <p className="text-slate-gray text-center py-20 text-sm">Cargando métricas...</p>
        )}

        {incidentStats && unitStats && (
          <>
            {/* Units status */}
            <section className="mb-6">
              <h2 className="text-xs text-slate-gray uppercase tracking-widest mb-3 font-semibold">
                Estado de Unidades
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard label="Disponibles" value={unitStats.available} color="green" />
                <StatsCard label="En Ruta" value={unitStats.enRoute} color="blue" />
                <StatsCard label="En Escena" value={unitStats.onScene} color="amber" />
                <StatsCard label="Fuera de Servicio" value={unitStats.outOfService} color="slate" />
              </div>
            </section>

            {/* Incidents stats */}
            <section className="mb-6">
              <h2 className="text-xs text-slate-gray uppercase tracking-widest mb-3 font-semibold">
                Incidentes del Día
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard label="Total" value={incidentStats.total} color="blue" />
                <StatsCard label="Sin Atender" value={incidentStats.open} color="red" />
                <StatsCard label="En Atención" value={incidentStats.assigned} color="amber" />
                <StatsCard
                  label="Cerrados"
                  value={incidentStats.closed}
                  color="green"
                  sub={
                    incidentStats.avgResponseMinutes != null
                      ? `Resp. prom: ${incidentStats.avgResponseMinutes} min`
                      : undefined
                  }
                />
              </div>
            </section>

            {/* Charts */}
            <section className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <MiniBarChart
                title="Incidentes por Prioridad"
                data={incidentStats.byPriority}
                colorMap={PRIORITY_COLORS}
                labelMap={PRIORITY_LABELS}
              />
              <MiniBarChart
                title="Incidentes por Tipo"
                data={incidentStats.byType}
                labelMap={TYPE_LABELS}
              />
            </section>

            {/* Recent incidents table */}
            <section>
              <h2 className="text-xs text-slate-gray uppercase tracking-widest mb-3 font-semibold">
                Últimos Incidentes del Día
              </h2>
              <div className="bg-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-gray text-xs uppercase tracking-widest">
                      <th className="text-left px-4 py-2">Folio</th>
                      <th className="text-left px-4 py-2 hidden sm:table-cell">Tipo</th>
                      <th className="text-left px-4 py-2">Prioridad</th>
                      <th className="text-left px-4 py-2 hidden md:table-cell">Dirección</th>
                      <th className="text-left px-4 py-2">Estado</th>
                      <th className="text-left px-4 py-2">Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentIncidents.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-slate-gray py-10 text-sm">
                          Sin incidentes para esta fecha
                        </td>
                      </tr>
                    )}
                    {recentIncidents.map((inc) => {
                      const statusInfo = STATUS_BADGE[inc.status] ?? {
                        label: inc.status,
                        className: 'bg-slate-700 text-slate-300',
                      };
                      return (
                        <tr
                          key={inc.id}
                          className="border-b border-slate-700 hover:bg-slate-700 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-signal-white font-bold text-xs">
                            {inc.folio}
                          </td>
                          <td className="px-4 py-3 text-slate-300 text-xs capitalize hidden sm:table-cell">
                            {TYPE_LABELS[inc.type] ?? inc.type}
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold" style={{ color: PRIORITY_COLORS[inc.priority] }}>
                            {PRIORITY_LABELS[inc.priority] ?? inc.priority}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-[180px] hidden md:table-cell">
                            {inc.address ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.className}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                            {new Date(inc.createdAt).toLocaleTimeString('es-MX', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
