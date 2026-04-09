'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { incidentsApi, unitsApi } from '@/lib/api';
import type { IncidentStats, UnitStats, Incident, DailySummary } from '@/lib/types';
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
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
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
      incidentsApi.getDailySummary(date),
    ])
      .then(([statsRes, unitStatsRes, incidentsRes, summaryRes]) => {
        setIncidentStats(statsRes.data);
        setUnitStats(unitStatsRes.data);
        setDailySummary(summaryRes.data);
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

  const downloadCSV = () => {
    const headers = ['Folio', 'Tipo', 'Prioridad', 'Estado', 'Dirección', 'Hora'];
    const rows = recentIncidents.map((inc) => [
      inc.folio,
      TYPE_LABELS[inc.type] ?? inc.type,
      PRIORITY_LABELS[inc.priority] ?? inc.priority,
      STATUS_BADGE[inc.status]?.label ?? inc.status,
      inc.address ?? '',
      new Date(inc.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `incidentes-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
          <button
            onClick={downloadCSV}
            disabled={recentIncidents.length === 0}
            className="text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-signal-white px-3 py-1 rounded transition-colors"
            aria-label="Exportar a CSV"
          >
            ↓ CSV
          </button>
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
      <main className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full space-y-0">
        {loading && !incidentStats && (
          <p className="text-slate-gray text-center py-20 text-sm">Cargando métricas...</p>
        )}

        {incidentStats && unitStats && (
          <>
            {/* Units status */}
            <section className="mb-8">
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

            {/* Units status bar chart */}
            <section className="mb-8">
              <h2 className="text-xs text-slate-gray uppercase tracking-widest mb-3 font-semibold">
                Distribución de Unidades
              </h2>
              <div className="bg-slate-800 rounded-lg p-4">
                {(() => {
                  const statuses = [
                    { label: 'Disponibles', value: unitStats.available, color: 'bg-green-500' },
                    { label: 'En Ruta', value: unitStats.enRoute, color: 'bg-tactical-blue' },
                    { label: 'En Escena', value: unitStats.onScene, color: 'bg-alert-amber' },
                    { label: 'Fuera de Servicio', value: unitStats.outOfService, color: 'bg-red-500' },
                  ];
                  const max = Math.max(...statuses.map((s) => s.value), 1);
                  return (
                    <div className="space-y-3">
                      {statuses.map((s) => (
                        <div key={s.label} className="flex items-center gap-3">
                          <span className="text-xs text-slate-400 w-36 shrink-0">{s.label}</span>
                          <div className="flex-1 bg-slate-700 rounded-full h-5 overflow-hidden">
                            <div
                              className={`${s.color} h-full rounded-full transition-all duration-700 ease-out`}
                              style={{ width: `${(s.value / max) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-mono text-signal-white w-8 text-right">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </section>

            {/* Incidents stats + Avg dispatch time */}
            <section className="mb-8">
              <h2 className="text-xs text-slate-gray uppercase tracking-widest mb-3 font-semibold">
                Incidentes del Día
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatsCard label="Total" value={incidentStats.total} color="blue" />
                <StatsCard label="Sin Atender" value={incidentStats.open} color="red" />
                <StatsCard label="En Atención" value={incidentStats.assigned} color="amber" />
                <StatsCard label="Cerrados" value={incidentStats.closed} color="green" />
                <StatsCard
                  label="Tiempo Despacho Prom."
                  value={
                    incidentStats.avgResponseMinutes != null
                      ? `${incidentStats.avgResponseMinutes} min`
                      : '—'
                  }
                  color={
                    incidentStats.avgResponseMinutes != null && incidentStats.avgResponseMinutes <= 2
                      ? 'green'
                      : incidentStats.avgResponseMinutes != null && incidentStats.avgResponseMinutes <= 5
                        ? 'amber'
                        : 'red'
                  }
                  sub="Meta: < 2 min"
                />
              </div>
            </section>

            {/* Charts */}
            <section className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
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

            {/* Daily Insights */}
            {dailySummary && dailySummary.totalIncidents > 0 && (
              <section className="mb-8">
                <h2 className="text-xs text-slate-gray uppercase tracking-widest mb-3 font-semibold">
                  Insights del Día
                </h2>
                <div className="bg-slate-800 rounded-lg p-5 space-y-3 border-l-4 border-blue-500 shadow-[inset_0_1px_0_0_rgba(59,130,246,0.15)]">
                  {dailySummary.busiestSector && (
                    <div className="flex items-start gap-2">
                      <span className="text-alert-amber mt-0.5">*</span>
                      <p className="text-sm text-signal-white">
                        El sector <span className="font-bold text-tactical-blue">{dailySummary.busiestSector.name}</span> tuvo la mayor actividad con <span className="font-mono font-bold">{dailySummary.busiestSector.count}</span> incidentes
                      </p>
                    </div>
                  )}
                  {dailySummary.bestUnit && (
                    <div className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">*</span>
                      <p className="text-sm text-signal-white">
                        La unidad <span className="font-bold text-tactical-blue">{dailySummary.bestUnit.callSign}</span> tuvo el mejor tiempo de respuesta: <span className="font-mono font-bold">{dailySummary.bestUnit.avgResponseMin} min</span>
                      </p>
                    </div>
                  )}
                  {dailySummary.worstHour && (
                    <div className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">*</span>
                      <p className="text-sm text-signal-white">
                        La hora más activa fue <span className="font-mono font-bold">{String(dailySummary.worstHour.hour).padStart(2, '0')}:00–{String(dailySummary.worstHour.hour + 1).padStart(2, '0')}:00</span> con <span className="font-mono font-bold">{dailySummary.worstHour.count}</span> incidentes
                      </p>
                    </div>
                  )}
                  {dailySummary.comparedToYesterday.incidents !== 0 && (
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 ${dailySummary.comparedToYesterday.incidents > 0 ? 'text-red-400' : 'text-green-400'}`}>*</span>
                      <p className="text-sm text-signal-white">
                        Incidentes{' '}
                        <span className={`font-mono font-bold ${dailySummary.comparedToYesterday.incidents > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {dailySummary.comparedToYesterday.incidents > 0 ? '+' : ''}{dailySummary.comparedToYesterday.incidents}%
                        </span>{' '}
                        vs ayer
                      </p>
                    </div>
                  )}
                  {dailySummary.comparedToYesterday.responseTime != null && (
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 ${dailySummary.comparedToYesterday.responseTime > 0 ? 'text-red-400' : 'text-green-400'}`}>*</span>
                      <p className="text-sm text-signal-white">
                        Tiempo de respuesta{' '}
                        <span className={`font-mono font-bold ${dailySummary.comparedToYesterday.responseTime > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {dailySummary.comparedToYesterday.responseTime > 0 ? '+' : ''}{dailySummary.comparedToYesterday.responseTime}%
                        </span>{' '}
                        vs ayer
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Shift report */}
            <section className="mb-8">
              <h2 className="text-xs text-slate-gray uppercase tracking-widest mb-3 font-semibold">
                Resumen de Turno — {new Date(date).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h2>
              <div className="bg-slate-800 rounded-lg p-5 grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Incidentes Creados</p>
                  <p className="text-2xl font-bold font-mono text-tactical-blue">{incidentStats.total}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Incidentes Cerrados</p>
                  <p className="text-2xl font-bold font-mono text-green-400">{incidentStats.closed}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Tasa de Cierre</p>
                  <p className="text-2xl font-bold font-mono text-signal-white">
                    {incidentStats.total > 0
                      ? `${Math.round((incidentStats.closed / incidentStats.total) * 100)}%`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Unidades Activas</p>
                  <p className="text-2xl font-bold font-mono text-alert-amber">
                    {unitStats.total - unitStats.outOfService}
                    <span className="text-sm text-slate-500 font-normal"> / {unitStats.total}</span>
                  </p>
                </div>
              </div>
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
