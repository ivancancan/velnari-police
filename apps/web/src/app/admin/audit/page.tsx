'use client';
import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Search, RefreshCw } from 'lucide-react';

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  ipAddress?: string;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Crear',
  update: 'Actualizar',
  delete: 'Eliminar',
  login: 'Login',
  assign: 'Asignar',
  close: 'Cerrar',
};

const ENTITY_COLORS: Record<string, string> = {
  incidents: 'bg-amber-100 text-amber-700',
  units: 'bg-blue-100 text-blue-700',
  users: 'bg-purple-100 text-purple-700',
  sectors: 'bg-green-100 text-green-700',
  patrols: 'bg-cyan-100 text-cyan-700',
};

function todayStr() { return new Date().toISOString().slice(0, 10); }
function weekAgoStr() {
  const d = new Date(); d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(weekAgoStr());
  const [to, setTo] = useState(todayStr());
  const [entityType, setEntityType] = useState('');
  const [fetched, setFetched] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        from: `${from}T00:00:00Z`,
        to: `${to}T23:59:59Z`,
        limit: '100',
      };
      if (entityType) params['entityType'] = entityType;
      const res = await api.get<{ logs: AuditLog[]; total: number }>('/audit', { params });
      setLogs(res.data.logs);
      setTotal(res.data.total);
      setFetched(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [from, to, entityType]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">Registro de todas las acciones de escritura en el sistema</p>
        </div>
        {fetched && (
          <span className="text-sm text-gray-500">{total} registros</span>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Desde</label>
            <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
              className="border border-gray-300 text-gray-900 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Hasta</label>
            <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}
              className="border border-gray-300 text-gray-900 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Entidad</label>
            <select value={entityType} onChange={e => setEntityType(e.target.value)}
              className="border border-gray-300 text-gray-900 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]">
              <option value="">Todas</option>
              {['incidents', 'units', 'users', 'sectors', 'patrols'].map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <button onClick={fetchLogs} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {!fetched ? (
          <div className="py-16 text-center text-gray-400 text-sm">Selecciona un rango de fechas y haz clic en Buscar</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">Sin registros en este período</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-medium">Fecha / Hora</th>
                <th className="px-5 py-3 text-left font-medium">Entidad</th>
                <th className="px-5 py-3 text-left font-medium">Acción</th>
                <th className="px-5 py-3 text-left font-medium">ID Entidad</th>
                <th className="px-5 py-3 text-left font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-gray-500 text-xs font-mono whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('es-MX', {
                      dateStyle: 'short', timeStyle: 'medium',
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ENTITY_COLORS[log.entityType] ?? 'bg-gray-100 text-gray-600'}`}>
                      {log.entityType}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-700 font-medium">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </td>
                  <td className="px-5 py-3 text-gray-400 font-mono text-xs truncate max-w-[160px]">
                    {log.entityId}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{log.ipAddress ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
