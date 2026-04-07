// apps/web/src/components/units/UnitDetailPanel.tsx
'use client';

import { useEffect, useState } from 'react';
import { useUnitsStore } from '@/store/units.store';
import { unitsApi } from '@/lib/api';
import type { LocationHistoryPoint, Incident, Unit } from '@/lib/types';

const STATUS_LABELS: Record<string, string> = {
  available: 'Disponible',
  en_route: 'En ruta',
  on_scene: 'En escena',
  out_of_service: 'Fuera de servicio',
};

const STATUS_COLORS: Record<string, string> = {
  available: 'text-green-400',
  en_route: 'text-blue-400',
  on_scene: 'text-amber-400',
  out_of_service: 'text-slate-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-amber-400',
  low: 'text-green-400',
};

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`;
}

function endOfDay(dateStr: string): string {
  return `${dateStr}T23:59:59.999Z`;
}

interface UnitDetailPanelProps {
  unit: Unit;
  onTrailChange: (points: LocationHistoryPoint[]) => void;
}

export default function UnitDetailPanel({ unit, onTrailChange }: UnitDetailPanelProps) {
  const { selectUnit } = useUnitsStore();
  const [date, setDate] = useState<string>(toDateString(new Date()));
  const [history, setHistory] = useState<LocationHistoryPoint[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const from = startOfDay(date);
    const to = endOfDay(date);

    Promise.all([
      unitsApi.getHistory(unit.id, from, to),
      unitsApi.getIncidentsByUnit(unit.id, from, to),
    ])
      .then(([histRes, incRes]) => {
        setHistory(histRes.data);
        setIncidents(incRes.data);
        onTrailChange(histRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [unit.id, date, onTrailChange]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { selectUnit(null); onTrailChange([]); }}
            className="text-slate-gray hover:text-signal-white transition-colors text-sm"
            aria-label="Volver a incidentes"
          >
            ←
          </button>
          <span className="font-bold text-signal-white font-mono">{unit.callSign}</span>
          <span className={`text-xs ${STATUS_COLORS[unit.status] ?? 'text-slate-gray'}`}>
            {STATUS_LABELS[unit.status] ?? unit.status}
          </span>
        </div>
        <input
          type="date"
          value={date}
          max={toDateString(new Date())}
          onChange={(e) => setDate(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-signal-white text-xs focus:outline-none focus:border-tactical-blue"
          aria-label="Filtrar por fecha"
        />
      </div>

      {/* Stats row */}
      <div className="flex gap-4 px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="text-center">
          <p className="text-2xl font-bold text-tactical-blue font-mono">{history.length}</p>
          <p className="text-xs text-slate-gray">Puntos GPS</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-alert-amber font-mono">{incidents.length}</p>
          <p className="text-xs text-slate-gray">Incidentes</p>
        </div>
        {unit.shift && (
          <div className="text-center">
            <p className="text-sm font-semibold text-signal-white">{unit.shift}</p>
            <p className="text-xs text-slate-gray">Turno</p>
          </div>
        )}
      </div>

      {/* Incidents list */}
      <div className="flex-1 overflow-y-auto">
        <p className="px-4 py-2 text-xs font-semibold text-slate-gray uppercase tracking-widest border-b border-slate-800">
          Incidentes del día
        </p>

        {loading && (
          <p className="text-center text-slate-gray text-sm py-8">Cargando...</p>
        )}

        {!loading && incidents.length === 0 && (
          <p className="text-center text-slate-gray text-sm py-12">
            Sin incidentes registrados
          </p>
        )}

        {!loading && incidents.map((incident) => (
          <div
            key={incident.id}
            className="px-4 py-3 border-b border-slate-800 hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-xs text-signal-white font-bold">{incident.folio}</span>
              <span className={`text-xs font-semibold uppercase ${PRIORITY_COLORS[incident.priority] ?? 'text-slate-gray'}`}>
                {incident.priority}
              </span>
            </div>
            <p className="text-xs text-slate-gray truncate">{incident.address ?? '—'}</p>
            <p className="text-xs text-slate-500 mt-1">
              {incident.assignedAt
                ? new Date(incident.assignedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                : '—'}
              {' · '}
              <span className="capitalize">{incident.type?.replace('_', ' ') ?? ''}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
