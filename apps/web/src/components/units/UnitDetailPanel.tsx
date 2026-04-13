// apps/web/src/components/units/UnitDetailPanel.tsx
'use client';

import { useEffect, useState } from 'react';
import { useUnitsStore } from '@/store/units.store';
import { unitsApi } from '@/lib/api';
import { reportError } from '@/lib/report-error';
import type { LocationHistoryPoint, Incident, Unit } from '@/lib/types';
import { UnitStatus } from '@velnari/shared-types';

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

const STATUS_OPTIONS = [
  { value: UnitStatus.AVAILABLE, label: 'Disponible' },
  { value: UnitStatus.EN_ROUTE, label: 'En ruta' },
  { value: UnitStatus.ON_SCENE, label: 'En escena' },
  { value: UnitStatus.OUT_OF_SERVICE, label: 'Fuera de servicio' },
];

export default function UnitDetailPanel({ unit, onTrailChange }: UnitDetailPanelProps) {
  const { selectUnit, updateUnit, positions } = useUnitsStore();
  const batteryLevel = positions[unit.id]?.batteryLevel ?? null;
  const batteryPct   = batteryLevel != null ? Math.round(batteryLevel * 100) : null;
  const batteryColor = batteryPct == null ? '#475569' : batteryPct > 50 ? '#22C55E' : batteryPct > 20 ? '#F59E0B' : '#EF4444';
  const [date, setDate] = useState<string>(toDateString(new Date()));
  const [history, setHistory] = useState<LocationHistoryPoint[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  async function handleStatusChange(newStatus: UnitStatus) {
    if (newStatus === unit.status || changingStatus) return;
    setChangingStatus(true);
    try {
      const res = await unitsApi.updateStatus(unit.id, newStatus);
      updateUnit(res.data);
    } catch (err) {
      reportError(err, { tag: 'unit.updateStatus' });
      if (typeof window !== 'undefined') {
        window.alert('No se pudo cambiar el estado de la unidad. Intenta de nuevo.');
      }
    } finally {
      setChangingStatus(false);
    }
  }

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
      .catch((err) => reportError(err, { tag: 'unit.loadHistory' }))
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

      {/* Status changer */}
      <div className="px-4 py-2.5 border-b border-slate-800 shrink-0">
        <p className="text-xs text-slate-gray mb-1.5">Cambiar estado</p>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleStatusChange(opt.value)}
              disabled={changingStatus}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                unit.status === opt.value
                  ? 'bg-tactical-blue text-white'
                  : 'bg-slate-800 text-slate-gray hover:bg-slate-700 hover:text-signal-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
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

      {/* Battery row */}
      <div className="px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-gray flex items-center gap-1">
            🔋 Batería del dispositivo
          </span>
          <span
            className="text-sm font-bold font-mono"
            style={{ color: batteryColor }}
          >
            {batteryPct != null ? `${batteryPct}%` : '—'}
          </span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: batteryPct != null ? `${batteryPct}%` : '0%',
              backgroundColor: batteryColor,
            }}
          />
        </div>
        {batteryPct != null && batteryPct <= 20 && (
          <p className="text-[11px] text-red-400 mt-1 animate-pulse">
            ⚡ Batería crítica — solicitar recarga
          </p>
        )}
        {batteryPct == null && (
          <p className="text-[11px] text-slate-500 mt-1">
            Sin datos de batería aún
          </p>
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
