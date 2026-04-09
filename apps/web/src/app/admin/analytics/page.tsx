'use client';
import { useEffect, useState, useCallback } from 'react';
import { incidentsApi, unitsApi, sectorsApi, usersApi } from '@/lib/api';
import type { AnalyticsResult } from '@/lib/types';
import type { Unit, Sector, User } from '@/lib/types';
import { exportToPdf } from '@/lib/pdf-export';
import { BarChart2, Download, FileText, Loader2, Search } from 'lucide-react';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function sevenDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-400',
  low: 'bg-green-500',
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Critica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Abierto',
  assigned: 'Asignado',
  en_route: 'En ruta',
  on_scene: 'En escena',
  closed: 'Cerrado',
};

const TYPE_LABELS: Record<string, string> = {
  robbery: 'Robo',
  assault: 'Asalto',
  traffic_accident: 'Accidente vial',
  domestic_violence: 'Violencia domestica',
  disturbance: 'Disturbio',
  vandalism: 'Vandalismo',
  suspicious_activity: 'Actividad sospechosa',
  medical_emergency: 'Emergencia medica',
  fire: 'Incendio',
  other: 'Otro',
};

const ITEMS_PER_PAGE = 15;

export default function AnalyticsPage() {
  const [from, setFrom] = useState(sevenDaysAgo());
  const [to, setTo] = useState(todayStr());
  const [unitId, setUnitId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [userId, setUserId] = useState('');

  const [units, setUnits] = useState<Unit[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);

  // Load filter options
  useEffect(() => {
    unitsApi.getAll({}).then(r => setUnits(r.data)).catch(() => {});
    sectorsApi.getAll().then(r => setSectors(r)).catch(() => {});
    usersApi.getAll().then(r => setUsers(r.data)).catch(() => {});
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    setData(null);
    setPage(0);
    try {
      const res = await incidentsApi.getAnalytics({
        from: `${from}T00:00:00.000Z`,
        to: `${to}T23:59:59.999Z`,
        ...(unitId ? { unitId } : {}),
        ...(sectorId ? { sectorId } : {}),
        ...(userId ? { userId } : {}),
      });
      setData(res.data);
    } catch {
      setError('Error al obtener datos. Verifica la conexion con el API.');
    } finally {
      setLoading(false);
    }
  }, [from, to, unitId, sectorId, userId]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Export CSV ───
  const exportCsv = () => {
    if (!data) return;
    const headers = ['Folio', 'Tipo', 'Prioridad', 'Estado', 'Fecha', 'Direccion', 'Patrullaje'];
    const rows = data.incidents.map(i => [
      i.folio,
      TYPE_LABELS[i.type] ?? i.type,
      PRIORITY_LABELS[i.priority] ?? i.priority,
      STATUS_LABELS[i.status] ?? i.status,
      new Date(i.createdAt).toLocaleString('es-MX'),
      i.address ?? '',
      i.patrolId ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analitica-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Export PDF ───
  const exportPdfReport = () => {
    if (!data) return;
    const s = data.summary;
    let html = `
      <p class="meta">Periodo: ${from} al ${to}</p>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-value">${s.totalIncidents}</div><div class="stat-label">Total</div></div>
        <div class="stat-card"><div class="stat-value">${s.closedIncidents}</div><div class="stat-label">Cerrados</div></div>
        <div class="stat-card"><div class="stat-value">${s.avgResponseMinutes != null ? s.avgResponseMinutes + ' min' : 'N/A'}</div><div class="stat-label">Resp. Prom.</div></div>
        <div class="stat-card"><div class="stat-value">${s.avgCloseMinutes != null ? s.avgCloseMinutes + ' min' : 'N/A'}</div><div class="stat-label">Cierre Prom.</div></div>
      </div>

      <h2>Por Prioridad</h2>
      <ul>${Object.entries(data.byPriority).map(([k, v]) => `<li>${PRIORITY_LABELS[k] ?? k}: ${v}</li>`).join('')}</ul>

      <h2>Por Tipo</h2>
      <ul>${Object.entries(data.byType).map(([k, v]) => `<li>${TYPE_LABELS[k] ?? k}: ${v}</li>`).join('')}</ul>

      <h2>Por Unidad</h2>
      <table><thead><tr><th>Unidad</th><th>Incidentes</th><th>Resp. Prom.</th></tr></thead><tbody>
      ${data.byUnit.map(u => `<tr><td>${u.callSign}</td><td>${u.count}</td><td>${u.avgResponseMin != null ? u.avgResponseMin + ' min' : 'N/A'}</td></tr>`).join('')}
      </tbody></table>

      <h2>Incidentes</h2>
      <table><thead><tr><th>Folio</th><th>Tipo</th><th>Prioridad</th><th>Estado</th><th>Fecha</th><th>Direccion</th></tr></thead><tbody>
      ${data.incidents.slice(0, 100).map(i => `<tr><td>${i.folio}</td><td>${TYPE_LABELS[i.type] ?? i.type}</td><td>${PRIORITY_LABELS[i.priority] ?? i.priority}</td><td>${STATUS_LABELS[i.status] ?? i.status}</td><td>${new Date(i.createdAt).toLocaleString('es-MX')}</td><td>${i.address ?? ''}</td></tr>`).join('')}
      </tbody></table>
    `;
    exportToPdf(`Reporte Analitico — ${from} al ${to}`, html);
  };

  // ─── Bar helper ───
  const Bar = ({ value, max, color, label }: { value: number; max: number; color: string; label: string }) => (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs text-gray-500 w-32 text-right truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: max > 0 ? `${Math.max((value / max) * 100, 2)}%` : '0%' }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-10 text-right">{value}</span>
    </div>
  );

  const totalPages = data ? Math.ceil(data.incidents.length / ITEMS_PER_PAGE) : 0;
  const paginatedIncidents = data?.incidents.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE) ?? [];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <BarChart2 size={20} className="text-blue-600" />
          Analitica de Incidentes
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Analisis profundo con filtros de fecha, unidad, sector y operador
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Unidad</label>
            <select
              value={unitId}
              onChange={e => setUnitId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-w-[140px]"
            >
              <option value="">Todas</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.callSign}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Sector</label>
            <select
              value={sectorId}
              onChange={e => setSectorId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-w-[140px]"
            >
              <option value="">Todos</option>
              {sectors.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Operador</label>
            <select
              value={userId}
              onChange={e => setUserId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-w-[140px]"
            >
              <option value="">Todos</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Analizar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" />
          Analizando datos...
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <SummaryCard label="Total Incidentes" value={data.summary.totalIncidents} color="text-gray-900" />
            <SummaryCard label="Cerrados" value={data.summary.closedIncidents} color="text-green-600" />
            <SummaryCard
              label="Tiempo Respuesta Prom."
              value={data.summary.avgResponseMinutes != null ? `${data.summary.avgResponseMinutes} min` : 'N/A'}
              color="text-blue-600"
            />
            <SummaryCard
              label="Tiempo Cierre Prom."
              value={data.summary.avgCloseMinutes != null ? `${data.summary.avgCloseMinutes} min` : 'N/A'}
              color="text-amber-600"
            />
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* By Day */}
            <ChartCard title="Incidentes por Dia">
              {data.byDay.length === 0 ? (
                <EmptyChart />
              ) : (
                <div className="space-y-1">
                  {data.byDay.map(d => (
                    <Bar
                      key={d.date}
                      label={new Date(d.date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                      value={d.count}
                      max={Math.max(...data.byDay.map(x => x.count))}
                      color="bg-blue-500"
                    />
                  ))}
                </div>
              )}
            </ChartCard>

            {/* By Hour */}
            <ChartCard title="Incidentes por Hora">
              {data.byHour.every(h => h.count === 0) ? (
                <EmptyChart />
              ) : (
                <div className="space-y-0.5">
                  {data.byHour.map(h => (
                    <Bar
                      key={h.hour}
                      label={`${String(h.hour).padStart(2, '0')}:00`}
                      value={h.count}
                      max={Math.max(...data.byHour.map(x => x.count))}
                      color="bg-indigo-500"
                    />
                  ))}
                </div>
              )}
            </ChartCard>

            {/* By Type */}
            <ChartCard title="Por Tipo">
              {Object.keys(data.byType).length === 0 ? (
                <EmptyChart />
              ) : (
                <div className="space-y-1">
                  {Object.entries(data.byType)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => (
                      <Bar
                        key={type}
                        label={TYPE_LABELS[type] ?? type}
                        value={count}
                        max={Math.max(...Object.values(data.byType))}
                        color="bg-cyan-500"
                      />
                    ))}
                </div>
              )}
            </ChartCard>

            {/* By Priority */}
            <ChartCard title="Por Prioridad">
              {Object.keys(data.byPriority).length === 0 ? (
                <EmptyChart />
              ) : (
                <div className="space-y-1">
                  {['critical', 'high', 'medium', 'low']
                    .filter(p => (data.byPriority[p] ?? 0) > 0)
                    .map(p => (
                      <Bar
                        key={p}
                        label={PRIORITY_LABELS[p] ?? p}
                        value={data.byPriority[p] ?? 0}
                        max={Math.max(...Object.values(data.byPriority))}
                        color={PRIORITY_COLORS[p] ?? 'bg-gray-400'}
                      />
                    ))}
                </div>
              )}
            </ChartCard>

            {/* By Unit */}
            <ChartCard title="Por Unidad">
              {data.byUnit.length === 0 ? (
                <EmptyChart />
              ) : (
                <div className="space-y-1">
                  {data.byUnit.map(u => (
                    <div key={u.unitId} className="flex items-center gap-3 py-1">
                      <span className="text-xs text-gray-500 w-32 text-right truncate">{u.callSign}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-all duration-500"
                          style={{ width: `${Math.max((u.count / Math.max(...data.byUnit.map(x => x.count))) * 100, 2)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 w-10 text-right">{u.count}</span>
                      <span className="text-[10px] text-gray-400 w-16 text-right">
                        {u.avgResponseMin != null ? `${u.avgResponseMin}m` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>

            {/* By Sector */}
            <ChartCard title="Por Sector">
              {data.bySector.length === 0 ? (
                <EmptyChart />
              ) : (
                <div className="space-y-1">
                  {data.bySector.map(s => (
                    <Bar
                      key={s.sectorId}
                      label={s.sectorName}
                      value={s.count}
                      max={Math.max(...data.bySector.map(x => x.count))}
                      color="bg-emerald-500"
                    />
                  ))}
                </div>
              )}
            </ChartCard>
          </div>

          {/* Export buttons */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={exportCsv}
              className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <Download size={14} />
              Exportar CSV
            </button>
            <button
              onClick={exportPdfReport}
              className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <FileText size={14} />
              Exportar PDF
            </button>
          </div>

          {/* Incidents table */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                Incidentes ({data.incidents.length})
              </h3>
              {totalPages > 1 && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
                  >
                    Ant.
                  </button>
                  <span>{page + 1} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
                  >
                    Sig.
                  </button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-2">Folio</th>
                    <th className="px-4 py-2">Tipo</th>
                    <th className="px-4 py-2">Prioridad</th>
                    <th className="px-4 py-2">Estado</th>
                    <th className="px-4 py-2">Fecha</th>
                    <th className="px-4 py-2">Direccion</th>
                    <th className="px-4 py-2">Patrullaje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedIncidents.map(inc => (
                    <tr key={inc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 font-mono text-xs font-semibold text-gray-900">{inc.folio}</td>
                      <td className="px-4 py-2 text-gray-700">{TYPE_LABELS[inc.type] ?? inc.type}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white ${PRIORITY_COLORS[inc.priority] ?? 'bg-gray-400'}`}>
                          {PRIORITY_LABELS[inc.priority] ?? inc.priority}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600 text-xs">{STATUS_LABELS[inc.status] ?? inc.status}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(inc.createdAt).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-xs max-w-[200px] truncate">{inc.address ?? '-'}</td>
                      <td className="px-4 py-2 text-gray-400 text-xs font-mono">{inc.patrolId ? inc.patrolId.slice(0, 8) + '...' : '-'}</td>
                    </tr>
                  ))}
                  {paginatedIncidents.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                        No se encontraron incidentes en este periodo
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center py-8 text-gray-300 text-sm">
      Sin datos
    </div>
  );
}
