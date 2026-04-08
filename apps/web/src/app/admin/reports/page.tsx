'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { unitsApi } from '@/lib/api';
import type { Unit, UnitReport } from '@/lib/types';
import UnitReportPanel from '@/components/admin/UnitReportPanel';

const TABS = [
  { label: 'Usuarios', href: '/admin' },
  { label: 'Sectores / Geocercas', href: '/admin/sectors' },
  { label: 'Reportes por Unidad', href: '/admin/reports' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [report, setReport] = useState<UnitReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    unitsApi.getAll({}).then(res => setUnits(res.data)).catch(console.error);
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
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header con tabs */}
      <header className="px-6 pt-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold tracking-wide">Administración</h1>
            <p className="text-slate-400 text-xs mt-0.5">Gestiona usuarios, sectores y reportes</p>
          </div>
          <Link href="/command" className="text-xs text-slate-400 hover:text-white transition-colors">
            ← Centro de Mando
          </Link>
        </div>
        <nav className="flex gap-1">
          {TABS.map(tab => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                pathname === tab.href
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-slate-600'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Filtros */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-white font-semibold text-sm mb-4">Generar reporte</h2>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-slate-400 text-xs block mb-1.5">Unidad</label>
              <select
                value={selectedUnitId}
                onChange={e => setSelectedUnitId(e.target.value)}
                className="bg-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-600 min-w-[160px]"
              >
                <option value="">Seleccionar unidad</option>
                {units.map(u => (
                  <option key={u.id} value={u.id}>{u.callSign}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1.5">Desde</label>
              <input
                type="date"
                value={from}
                max={to}
                onChange={e => setFrom(e.target.value)}
                className="bg-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-600"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1.5">Hasta</label>
              <input
                type="date"
                value={to}
                min={from}
                onChange={e => setTo(e.target.value)}
                className="bg-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-600"
              />
            </div>
            <button
              onClick={fetchReport}
              disabled={!selectedUnitId || loading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? 'Generando…' : 'Generar reporte'}
            </button>
          </div>
          {error && (
            <p className="text-red-400 text-xs mt-3">{error}</p>
          )}
        </div>

        {/* Reporte */}
        {report && <UnitReportPanel report={report} />}

        {!report && !loading && !error && (
          <div className="text-center py-16 text-slate-500">
            <p className="text-lg">Selecciona una unidad y un rango de fechas</p>
            <p className="text-sm mt-1">El reporte mostrará incidentes atendidos, tiempos de respuesta y actividad GPS</p>
          </div>
        )}
      </main>
    </div>
  );
}
