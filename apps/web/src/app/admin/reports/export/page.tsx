// apps/web/src/app/admin/reports/export/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { incidentsApi } from '@/lib/api';
import type { Incident } from '@/lib/types';
import { useAuthStore } from '@/store/auth.store';

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Bajo',
};
const TYPE_LABELS: Record<string, string> = {
  robbery: 'Robo', assault: 'Agresión', traffic: 'Accidente vial',
  noise: 'Ruido', domestic: 'Violencia doméstica',
  missing_person: 'Persona desaparecida', other: 'Otro',
};
const STATUS_LABELS: Record<string, string> = {
  open: 'Abierto', assigned: 'Asignado', en_route: 'En Ruta',
  on_scene: 'En Escena', closed: 'Cerrado',
};

export default function ExportPage() {
  const { user } = useAuthStore();
  const today = toDateString(new Date());
  const weekAgo = toDateString(new Date(Date.now() - 7 * 24 * 60 * 60_000));

  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function handleLoad() {
    setLoading(true);
    try {
      const res = await incidentsApi.getAll();
      const filtered = res.data.filter((inc) => {
        const d = inc.createdAt.slice(0, 10);
        return d >= startDate && d <= endDate;
      });
      filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setIncidents(filtered);
      setLoaded(true);
    } catch {
      alert('Error al cargar incidentes.');
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    const headers = ['Folio', 'Tipo', 'Prioridad', 'Estado', 'Dirección', 'Fecha', 'Hora', 'Resolución'];
    const rows = incidents.map((inc) => [
      inc.folio,
      TYPE_LABELS[inc.type] ?? inc.type,
      PRIORITY_LABELS[inc.priority] ?? inc.priority,
      STATUS_LABELS[inc.status] ?? inc.status,
      inc.address ?? '',
      inc.createdAt.slice(0, 10),
      new Date(inc.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      inc.resolution ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incidentes-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-midnight-command">
      <header className="print:hidden flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-slate-gray hover:text-signal-white text-sm transition-colors">
            ← Dashboard
          </Link>
          <span className="text-signal-white font-semibold">Exportar Incidentes</span>
        </div>
        <span className="text-sm text-slate-gray">{user?.name}</span>
      </header>

      <main className="px-6 py-8 max-w-6xl mx-auto">
        <div className="print:hidden mb-8 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-slate-gray mb-1">Desde</label>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white text-sm focus:outline-none focus:border-tactical-blue"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-gray mb-1">Hasta</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={today}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white text-sm focus:outline-none focus:border-tactical-blue"
            />
          </div>
          <button
            onClick={handleLoad}
            disabled={loading}
            className="bg-tactical-blue hover:bg-blue-600 disabled:opacity-50 text-white px-5 py-2 rounded text-sm font-semibold transition-colors"
          >
            {loading ? 'Cargando...' : 'Cargar'}
          </button>
          {loaded && (
            <>
              <button
                onClick={downloadCSV}
                disabled={incidents.length === 0}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-signal-white px-4 py-2 rounded text-sm transition-colors"
              >
                ↓ CSV
              </button>
              <button
                onClick={() => window.print()}
                disabled={incidents.length === 0}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-signal-white px-4 py-2 rounded text-sm transition-colors"
              >
                🖨 PDF
              </button>
            </>
          )}
        </div>

        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-bold">Velnari — Reporte de Incidentes</h1>
          <p className="text-gray-600 text-sm">Período: {startDate} al {endDate} · Total: {incidents.length}</p>
        </div>

        {loaded && incidents.length === 0 && (
          <p className="text-slate-gray text-center py-20 text-sm">
            Sin incidentes en el rango seleccionado.
          </p>
        )}

        {incidents.length > 0 && (
          <>
            <p className="print:hidden text-slate-gray text-xs mb-4">
              {incidents.length} incidentes encontrados
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 print:border-gray-300">
                    {['Folio', 'Tipo', 'Prioridad', 'Estado', 'Dirección', 'Fecha', 'Resolución'].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-xs text-slate-gray print:text-gray-500 uppercase tracking-widest font-semibold whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((inc) => (
                    <tr
                      key={inc.id}
                      className="border-b border-slate-800 print:border-gray-200 hover:bg-slate-800/40 print:hover:bg-transparent transition-colors"
                    >
                      <td className="px-3 py-2 font-mono text-signal-white print:text-black text-xs whitespace-nowrap">{inc.folio}</td>
                      <td className="px-3 py-2 text-slate-300 print:text-gray-800">{TYPE_LABELS[inc.type] ?? inc.type}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            inc.priority === 'critical' ? 'bg-red-900 text-red-300'
                              : inc.priority === 'high' ? 'bg-orange-900 text-orange-300'
                                : inc.priority === 'medium' ? 'bg-amber-900 text-amber-300'
                                  : 'bg-green-900 text-green-300'
                          }`}
                        >
                          {PRIORITY_LABELS[inc.priority] ?? inc.priority}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-300 print:text-gray-800">{STATUS_LABELS[inc.status] ?? inc.status}</td>
                      <td className="px-3 py-2 text-slate-400 print:text-gray-600 max-w-xs truncate">{inc.address ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-400 print:text-gray-600 whitespace-nowrap font-mono text-xs">
                        {inc.createdAt.slice(0, 10)}
                        <span className="ml-1 text-slate-500">
                          {new Date(inc.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-400 print:text-gray-600">{inc.resolution ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
