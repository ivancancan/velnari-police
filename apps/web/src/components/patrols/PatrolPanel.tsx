// apps/web/src/components/patrols/PatrolPanel.tsx
'use client';

import { useEffect, useState } from 'react';
import { patrolsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { permissions } from '@/lib/permissions';
import type { Patrol, Sector, Unit } from '@/lib/types';

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'text-slate-gray',
  active:    'text-green-400',
  completed: 'text-tactical-blue',
  cancelled: 'text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Programado',
  active:    'Activo',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

// Start offset options in minutes
const START_OFFSETS = [
  { label: 'Ahora',    minutes: 0  },
  { label: '+15 min',  minutes: 15 },
  { label: '+30 min',  minutes: 30 },
  { label: '+1 h',     minutes: 60 },
];

// Duration options in hours
const DURATIONS = [
  { label: '4 h',  hours: 4  },
  { label: '6 h',  hours: 6  },
  { label: '8 h',  hours: 8  },
  { label: '12 h', hours: 12 },
];

function addMinutes(date: Date, mins: number): Date {
  return new Date(date.getTime() + mins * 60_000);
}

function addHours(date: Date, hrs: number): Date {
  return new Date(date.getTime() + hrs * 3_600_000);
}

function fmt(date: Date): string {
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

interface PatrolPanelProps {
  units: Unit[];
  sectors: Sector[];
}

export default function PatrolPanel({ units, sectors }: PatrolPanelProps) {
  const user = useAuthStore((s) => s.user);
  const canCreate = permissions.createPatrol(user?.role as never);
  const canCancel = permissions.cancelPatrol(user?.role as never);
  const [patrols, setPatrols] = useState<Patrol[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [unitId, setUnitId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [startOffset, setStartOffset] = useState(0);       // minutes from now
  const [durationHours, setDurationHours] = useState(6);   // hours
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadPatrols() {
    patrolsApi.getActive().then((res) => setPatrols(res.data)).catch(console.error);
  }

  useEffect(() => { loadPatrols(); }, []);

  // Preview times
  const now = new Date();
  const previewStart = addMinutes(now, startOffset);
  const previewEnd   = addHours(previewStart, durationHours);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!unitId || !sectorId) return;
    setCreating(true);
    setError(null);
    try {
      const start = addMinutes(new Date(), startOffset);
      const end   = addHours(start, durationHours);
      await patrolsApi.create({
        unitId,
        sectorId,
        startAt: start.toISOString(),
        endAt:   end.toISOString(),
      });
      setShowCreate(false);
      setUnitId(''); setSectorId('');
      setStartOffset(0); setDurationHours(6);
      loadPatrols();
    } catch (err: unknown) {
      console.error('[PatrolPanel] create error:', err);
      const axiosErr = err as { response?: { status?: number; data?: unknown } };
      const data = axiosErr?.response?.data;
      const status = axiosErr?.response?.status;
      const msg = (data as { message?: string | string[] })?.message;
      setError(
        typeof msg === 'string' ? `${status}: ${msg}` :
        Array.isArray(msg) ? `${status}: ${msg.join(', ')}` :
        `HTTP ${status} — ${JSON.stringify(data)}`
      );
    } finally {
      setCreating(false);
    }
  }

  const chipBase = 'px-2.5 py-1 rounded text-xs font-medium transition-colors';
  const chipOn   = 'bg-tactical-blue text-white';
  const chipOff  = 'bg-slate-800 text-slate-gray hover:text-signal-white border border-slate-700';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h3 className="text-xs font-semibold text-slate-gray uppercase tracking-wide">Patrullajes</h3>
        {canCreate && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="text-xs text-tactical-blue hover:underline"
          >
            {showCreate ? 'Cancelar' : '+ Nuevo'}
          </button>
        )}
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="p-4 border-b border-slate-800 space-y-3">
          {/* Unit */}
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-signal-white text-xs focus:outline-none focus:border-tactical-blue"
          >
            <option value="">— Unidad —</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.callSign}</option>)}
          </select>

          {/* Sector */}
          <select
            value={sectorId}
            onChange={(e) => setSectorId(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-signal-white text-xs focus:outline-none focus:border-tactical-blue"
          >
            <option value="">— Sector —</option>
            {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          {/* Start time */}
          <div>
            <p className="text-xs text-slate-gray mb-1.5">Inicio del patrullaje</p>
            <div className="flex gap-1.5 flex-wrap">
              {START_OFFSETS.map((opt) => (
                <button
                  key={opt.minutes}
                  type="button"
                  onClick={() => setStartOffset(opt.minutes)}
                  className={`${chipBase} ${startOffset === opt.minutes ? chipOn : chipOff}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-tactical-blue mt-1 font-mono">{fmt(previewStart)}</p>
          </div>

          {/* Duration / expected return */}
          <div>
            <p className="text-xs text-slate-gray mb-1.5">Regreso esperado</p>
            <div className="flex gap-1.5 flex-wrap">
              {DURATIONS.map((opt) => (
                <button
                  key={opt.hours}
                  type="button"
                  onClick={() => setDurationHours(opt.hours)}
                  className={`${chipBase} ${durationHours === opt.hours ? chipOn : chipOff}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-tactical-blue mt-1 font-mono">{fmt(previewEnd)}</p>
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-950/50 border border-red-800/50 rounded px-2 py-1.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={creating || !unitId || !sectorId}
            className="w-full bg-tactical-blue hover:bg-blue-600 disabled:opacity-50 text-white text-xs rounded py-1.5 font-medium transition-colors"
          >
            {creating ? 'Asignando…' : 'Asignar patrullaje'}
          </button>
        </form>
      )}

      <div className="flex-1 overflow-y-auto">
        {patrols.length === 0 ? (
          <p className="text-slate-gray text-xs text-center py-8">Sin patrullajes activos.</p>
        ) : (
          patrols.map((patrol) => (
            <div key={patrol.id} className="px-4 py-3 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-signal-white text-xs font-medium">
                  {patrol.unit?.callSign ?? patrol.unitId.slice(0, 8)}
                </span>
                <span className={`text-xs ${STATUS_COLORS[patrol.status]}`}>
                  {STATUS_LABELS[patrol.status]}
                </span>
              </div>
              <div className="text-slate-gray text-xs mt-0.5">
                {patrol.sector?.name ?? patrol.sectorId.slice(0, 8)}
              </div>
              <div className="text-slate-gray text-xs font-mono">
                {new Date(patrol.startAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                {' → '}
                {new Date(patrol.endAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {canCancel && (patrol.status === 'scheduled' || patrol.status === 'active') && (
                <button
                  onClick={() => {
                    if (cancelling) return;
                    if (!confirm('¿Cancelar patrullaje?')) return;
                    setCancelling(patrol.id);
                    patrolsApi.cancel(patrol.id)
                      .then(() => loadPatrols())
                      .catch(console.error)
                      .finally(() => setCancelling(null));
                  }}
                  disabled={cancelling === patrol.id}
                  className="text-xs text-red-400 hover:underline mt-1 disabled:opacity-50"
                >
                  Cancelar
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
