'use client';

import { useState } from 'react';
import { useIncidentsStore } from '@/store/incidents.store';
import { dispatchApi } from '@/lib/api';
import type { Incident, SuggestedUnit } from '@/lib/types';
import Spinner from '@/components/ui/Spinner';

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-900 text-red-300 border-red-700',
  high: 'bg-orange-900 text-orange-300 border-orange-700',
  medium: 'bg-amber-900 text-amber-300 border-amber-700',
  low: 'bg-green-900 text-green-300 border-green-700',
};

const TYPE_LABELS: Record<string, string> = {
  robbery: 'Robo',
  assault: 'Agresión',
  traffic: 'Tráfico',
  noise: 'Ruido',
  domestic: 'Doméstico',
  missing_person: 'Persona desaparecida',
  other: 'Otro',
};

function waitingTime(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

interface DispatchRowProps {
  incident: Incident;
  onDispatched: () => void;
}

function DispatchRow({ incident, onDispatched }: DispatchRowProps) {
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<SuggestedUnit | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateIncident = useIncidentsStore((s) => s.updateIncident);

  async function handleDispatchClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await dispatchApi.getSuggestions(incident.id);
      const top = res.data[0];
      if (!top) {
        setError('Sin unidades disponibles');
        return;
      }
      setConfirm(top);
    } catch {
      setError('Error al obtener sugerencias');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!confirm) return;
    setDispatching(true);
    try {
      const res = await dispatchApi.assignUnit(incident.id, confirm.unitId);
      updateIncident(res.data);
      onDispatched();
    } catch {
      setError('Error al despachar');
    } finally {
      setDispatching(false);
      setConfirm(null);
    }
  }

  const isOpen = incident.status === 'open';

  return (
    <div className="border-b border-slate-800 px-4 py-3 hover:bg-slate-800/40 transition-colors">
      <div className="flex items-start gap-3">
        {/* Priority badge */}
        <span
          className={`mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0 ${PRIORITY_COLORS[incident.priority] ?? 'bg-slate-800 text-slate-gray border-slate-700'}`}
        >
          {PRIORITY_LABELS[incident.priority] ?? incident.priority}
        </span>

        {/* Incident info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-signal-white font-semibold truncate">
              {incident.folio}
            </span>
            <span className="text-[10px] text-slate-gray truncate">
              {TYPE_LABELS[incident.type] ?? incident.type}
            </span>
          </div>
          {incident.address && (
            <p className="text-[10px] text-slate-400 truncate mt-0.5">{incident.address}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-semibold ${isOpen ? 'text-amber-400' : 'text-blue-400'}`}>
              {isOpen ? 'Sin unidad' : 'Asignado'}
            </span>
            <span className="text-[10px] text-slate-500">· {waitingTime(incident.createdAt)}</span>
          </div>
        </div>

        {/* Action */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          {!confirm ? (
            <button
              onClick={handleDispatchClick}
              disabled={loading || !isOpen}
              className={`text-[11px] font-semibold px-3 py-1 rounded transition-colors ${
                isOpen
                  ? 'bg-tactical-blue hover:bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              {loading ? <Spinner size="sm" /> : 'Despachar'}
            </button>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <p className="text-[10px] text-slate-300">
                → <span className="font-semibold text-signal-white">{confirm.callSign}</span>
                <span className="text-slate-500 ml-1">({confirm.distanceKm.toFixed(1)} km)</span>
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setConfirm(null)}
                  className="text-[10px] px-2 py-0.5 rounded border border-slate-600 text-slate-gray hover:text-signal-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={dispatching}
                  className="text-[10px] px-2 py-0.5 rounded bg-green-700 hover:bg-green-600 text-white font-semibold transition-colors"
                >
                  {dispatching ? '...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}
          {error && (
            <p className="text-[10px] text-red-400">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DispatchQueue() {
  const incidents = useIncidentsStore((s) => s.incidents);
  const [dispatchedIds, setDispatchedIds] = useState<Set<string>>(new Set());

  // Only show open incidents that haven't been dispatched this session
  const queue = incidents
    .filter((inc) => inc.status === 'open' && !dispatchedIds.has(inc.id))
    .sort((a, b) => {
      const pd = PRIORITY_ORDER[a.priority]! - PRIORITY_ORDER[b.priority]!;
      if (pd !== 0) return pd;
      // Oldest first within same priority
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  function handleDispatched(id: string) {
    setDispatchedIds((prev) => new Set([...prev, id]));
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <h2 className="text-sm font-semibold text-signal-white">Cola de Despacho</h2>
        <span className="text-xs font-mono text-slate-gray bg-slate-800 px-2 py-0.5 rounded-full">
          {queue.length} pendiente{queue.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <span className="text-2xl">✓</span>
            <p className="text-sm text-slate-gray">Sin incidentes sin despachar</p>
          </div>
        ) : (
          queue.map((incident) => (
            <DispatchRow
              key={incident.id}
              incident={incident}
              onDispatched={() => handleDispatched(incident.id)}
            />
          ))
        )}
      </div>

      {queue.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-800 shrink-0">
          <p className="text-[10px] text-slate-500">
            Ordenado por prioridad · Más antiguo primero en igual prioridad
          </p>
        </div>
      )}
    </div>
  );
}
