'use client';
import { useEffect, useState } from 'react';
import { unitsApi } from '@/lib/api';
import { reportError } from '@/lib/report-error';
import type { Unit, UnitReport } from '@/lib/types';
import UnitReportPanel from '@/components/admin/UnitReportPanel';
import { Search } from 'lucide-react';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [report, setReport] = useState<UnitReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    unitsApi.getAll({}).then(res => setUnits(res.data)).catch((err) => reportError(err, { tag: 'admin.reports' }));
  }, []);

  const fetchReport = async () => {
    if (!selectedUnitId) return;
    setLoading(true);
    setError('');
    setReport(null);
    try {
      const res = await unitsApi.getReport(
        selectedUnitId,
        `${from}T00:00:00.000Z`,
        `${to}T23:59:59.999Z`,
      );
      setReport(res.data);
    } catch {
      setError('Error al generar el reporte. Verifica la conexión con el API.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Reportes por Unidad</h1>
        <p className="text-sm text-gray-500 mt-0.5">Consulta actividad, incidentes y tiempos de respuesta por patrulla</p>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Unidad</label>
            <select
              value={selectedUnitId}
              onChange={e => setSelectedUnitId(e.target.value)}
              className="border border-gray-300 text-gray-900 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
            >
              <option value="">Seleccionar unidad</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.callSign}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Desde</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={e => setFrom(e.target.value)}
              className="border border-gray-300 text-gray-900 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Hasta</label>
            <input
              type="date"
              value={to}
              min={from}
              onChange={e => setTo(e.target.value)}
              className="border border-gray-300 text-gray-900 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={fetchReport}
            disabled={!selectedUnitId || loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            <Search size={14} />
            {loading ? 'Generando…' : 'Generar reporte'}
          </button>
        </div>
        {error && <p className="text-red-500 text-xs mt-3">{error}</p>}
      </div>

      {/* Resultado */}
      {report && <UnitReportPanel report={report} />}
      {!report && !loading && !error && (
        <div className="text-center py-20 text-gray-400">
          <BarChart2Icon />
          <p className="text-sm mt-3 font-medium text-gray-500">Selecciona una unidad y un rango de fechas</p>
          <p className="text-xs mt-1">El reporte mostrará incidentes atendidos, tiempos de respuesta y actividad GPS</p>
        </div>
      )}
    </div>
  );
}

function BarChart2Icon() {
  return (
    <svg className="mx-auto text-gray-300" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}
