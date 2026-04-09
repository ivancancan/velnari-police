'use client';

import { useEffect, useState } from 'react';
import { incidentsApi } from '@/lib/api';
import type { Incident } from '@/lib/types';
import { RefreshCw, Printer, FileDown } from 'lucide-react';

interface ShiftHandoffData {
  generatedAt: string;
  openIncidents: Incident[];
  assignedIncidents: Incident[];
  recentlyClosed: Incident[];
  notes: string[];
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};

const TYPE_LABEL: Record<string, string> = {
  robbery: 'Robo',
  assault: 'Agresión',
  traffic: 'Accidente vial',
  noise: 'Ruido',
  domestic: 'Doméstico',
  missing_person: 'Persona desaparecida',
  other: 'Otro',
};

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Abierto',
  assigned: 'Asignado',
  en_route: 'En camino',
  on_scene: 'En escena',
  closed: 'Cerrado',
};

function IncidentTable({ incidents, showResolution }: { incidents: Incident[]; showResolution?: boolean }) {
  if (incidents.length === 0) {
    return <p className="text-sm text-gray-400 italic py-3">Sin incidentes</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wider">
            <th className="py-2 pr-3">Folio</th>
            <th className="py-2 pr-3">Tipo</th>
            <th className="py-2 pr-3">Prioridad</th>
            <th className="py-2 pr-3">Estado</th>
            <th className="py-2 pr-3">Dirección</th>
            {showResolution && <th className="py-2 pr-3">Resolución</th>}
            <th className="py-2">Creado</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((inc) => (
            <tr key={inc.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 pr-3 font-mono font-medium text-gray-900">{inc.folio}</td>
              <td className="py-2 pr-3 text-gray-600">{TYPE_LABEL[inc.type] ?? inc.type}</td>
              <td className="py-2 pr-3">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLOR[inc.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                  {PRIORITY_LABEL[inc.priority] ?? inc.priority}
                </span>
              </td>
              <td className="py-2 pr-3 text-gray-600">{STATUS_LABEL[inc.status] ?? inc.status}</td>
              <td className="py-2 pr-3 text-gray-600 max-w-[200px] truncate">{inc.address ?? '-'}</td>
              {showResolution && (
                <td className="py-2 pr-3 text-gray-600 max-w-[200px] truncate">{inc.resolution ?? '-'}</td>
              )}
              <td className="py-2 text-gray-500 text-xs">
                {new Date(inc.createdAt).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function HandoffPage() {
  const [data, setData] = useState<ShiftHandoffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHandoff = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await incidentsApi.getShiftHandoff();
      setData(res.data as ShiftHandoffData);
    } catch {
      setError('Error al cargar datos de entrega de turno');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHandoff();
  }, []);

  const pendingCount = (data?.openIncidents.length ?? 0) + (data?.assignedIncidents.length ?? 0);
  const closedCount = data?.recentlyClosed.length ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto print:p-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 print:mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entrega de Turno</h1>
          {data && (
            <p className="text-sm text-gray-500 mt-1">
              Generado: {new Date(data.generatedAt).toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'short' })}
            </p>
          )}
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={fetchHandoff}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Printer size={14} />
            Imprimir
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Pending Incidents */}
          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Incidentes pendientes</h2>
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                {pendingCount}
              </span>
            </div>

            {data.openIncidents.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Abiertos (sin asignar)</h3>
                <IncidentTable incidents={data.openIncidents} />
              </div>
            )}

            {data.assignedIncidents.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Asignados (en proceso)</h3>
                <IncidentTable incidents={data.assignedIncidents} />
              </div>
            )}

            {pendingCount === 0 && (
              <p className="text-sm text-gray-400 italic">No hay incidentes pendientes</p>
            )}
          </section>

          {/* Recently Closed */}
          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Cerrados en este turno</h2>
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                {closedCount}
              </span>
            </div>
            <IncidentTable incidents={data.recentlyClosed} showResolution />
          </section>

          {/* Notes */}
          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notas del turno</h2>
            {data.notes.length > 0 ? (
              <ul className="space-y-2">
                {data.notes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    {note}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 italic">Sin notas en las últimas 8 horas</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
