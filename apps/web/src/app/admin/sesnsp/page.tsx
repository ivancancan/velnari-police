'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';

interface SesnspData {
  periodo: { inicio: string; fin: string };
  resumen: {
    totalIncidentes: number;
    porTipo: Record<string, number>;
    porPrioridad: Record<string, number>;
    porEstatus: Record<string, number>;
    tiempoPromedioRespuestaMin: number | null;
    tiempoPromedioCierreMin: number | null;
  };
  incidentes: {
    folio: string;
    tipo: string;
    prioridad: string;
    estatus: string;
    direccion: string;
    latitud: number;
    longitud: number;
    fechaCreacion: string;
    fechaAsignacion: string | null;
    fechaCierre: string | null;
    resolucion: string | null;
    unidadAsignada: string | null;
  }[];
}

function toCSV(data: SesnspData): string {
  const headers = [
    'Folio', 'Tipo', 'Prioridad', 'Estatus', 'Dirección',
    'Latitud', 'Longitud', 'Fecha Creación', 'Fecha Asignación',
    'Fecha Cierre', 'Resolución', 'Unidad Asignada',
  ];
  const rows = data.incidentes.map((inc) => [
    inc.folio, inc.tipo, inc.prioridad, inc.estatus,
    `"${inc.direccion.replace(/"/g, '""')}"`,
    inc.latitud, inc.longitud,
    inc.fechaCreacion, inc.fechaAsignacion ?? '',
    inc.fechaCierre ?? '', inc.resolucion ?? '', inc.unidadAsignada ?? '',
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SesnspPage() {
  const token = useAuthStore((s) => s.accessToken);
  const today = new Date().toISOString().split('T')[0]!;
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]!;

  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [data, setData] = useState<SesnspData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/incidents/sesnsp-export?from=${fromDate}&to=${toDate}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#F8FAFC] mb-1">Reporte SESNSP</h1>
        <p className="text-[#64748B] text-sm">Exportación de incidentes en formato compatible con el Secretariado Ejecutivo del Sistema Nacional de Seguridad Pública.</p>
      </div>

      {/* Date range + generate */}
      <div className="flex flex-wrap gap-4 mb-8 items-end">
        <div>
          <label className="block text-xs text-[#64748B] uppercase tracking-wider mb-1.5">Desde</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-[#1E293B] border border-[#334155] rounded-lg px-4 py-2.5 text-[#F8FAFC] text-sm focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="block text-xs text-[#64748B] uppercase tracking-wider mb-1.5">Hasta</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-[#1E293B] border border-[#334155] rounded-lg px-4 py-2.5 text-[#F8FAFC] text-sm focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-6 py-2.5 bg-[#3B82F6] hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors"
        >
          {loading ? 'Generando...' : 'Generar Reporte'}
        </button>
        {data && (
          <>
            <button
              onClick={() => downloadFile(toCSV(data), `sesnsp-${fromDate}-${toDate}.csv`, 'text/csv')}
              className="px-6 py-2.5 bg-[#1E293B] hover:bg-[#334155] border border-[#334155] rounded-lg text-sm font-semibold transition-colors"
            >
              Descargar CSV
            </button>
            <button
              onClick={() => downloadFile(JSON.stringify(data, null, 2), `sesnsp-${fromDate}-${toDate}.json`, 'application/json')}
              className="px-6 py-2.5 bg-[#1E293B] hover:bg-[#334155] border border-[#334155] rounded-lg text-sm font-semibold transition-colors"
            >
              Descargar JSON
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm mb-6">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4">
              <p className="text-xs text-[#64748B] uppercase tracking-wider mb-1">Total Incidentes</p>
              <p className="text-3xl font-bold text-[#F8FAFC]">{data.resumen.totalIncidentes}</p>
            </div>
            <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4">
              <p className="text-xs text-[#64748B] uppercase tracking-wider mb-1">Tiempo Prom. Respuesta</p>
              <p className="text-3xl font-bold text-[#3B82F6]">
                {data.resumen.tiempoPromedioRespuestaMin !== null ? `${data.resumen.tiempoPromedioRespuestaMin} min` : '—'}
              </p>
            </div>
            <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4">
              <p className="text-xs text-[#64748B] uppercase tracking-wider mb-2">Por Prioridad</p>
              {Object.entries(data.resumen.porPrioridad).map(([p, count]) => (
                <div key={p} className="flex justify-between text-sm">
                  <span className="text-[#64748B]">{p}</span>
                  <span className="font-mono">{count}</span>
                </div>
              ))}
            </div>
            <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4">
              <p className="text-xs text-[#64748B] uppercase tracking-wider mb-2">Por Estatus</p>
              {Object.entries(data.resumen.porEstatus).map(([s, count]) => (
                <div key={s} className="flex justify-between text-sm">
                  <span className="text-[#64748B]">{s}</span>
                  <span className="font-mono">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Incident table */}
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#334155]">
                  {['Folio', 'Tipo', 'Prioridad', 'Estatus', 'Dirección', 'Fecha Creación', 'Fecha Cierre', 'Unidad'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-[#64748B] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.incidentes.map((inc) => (
                  <tr key={inc.folio} className="border-b border-[#1E293B] hover:bg-[#0F172A] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{inc.folio}</td>
                    <td className="px-4 py-3">{inc.tipo}</td>
                    <td className="px-4 py-3">{inc.prioridad}</td>
                    <td className="px-4 py-3">{inc.estatus}</td>
                    <td className="px-4 py-3 text-[#64748B] max-w-xs truncate">{inc.direccion}</td>
                    <td className="px-4 py-3 text-xs">{new Date(inc.fechaCreacion).toLocaleString('es-MX')}</td>
                    <td className="px-4 py-3 text-xs">{inc.fechaCierre ? new Date(inc.fechaCierre).toLocaleString('es-MX') : '—'}</td>
                    <td className="px-4 py-3">{inc.unidadAsignada ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
