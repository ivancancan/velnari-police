// apps/web/src/components/patrols/PatrolPanel.tsx
'use client';

import { useEffect, useState } from 'react';
import { patrolsApi } from '@/lib/api';
import type { Patrol, Sector, Unit } from '@/lib/types';

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'text-slate-gray',
  active: 'text-green-400',
  completed: 'text-tactical-blue',
  cancelled: 'text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Programado',
  active: 'Activo',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

interface PatrolPanelProps {
  units: Unit[];
  sectors: Sector[];
}

export default function PatrolPanel({ units, sectors }: PatrolPanelProps) {
  const [patrols, setPatrols] = useState<Patrol[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [unitId, setUnitId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  function loadPatrols() {
    patrolsApi.getActive().then((res) => setPatrols(res.data)).catch(console.error);
  }

  useEffect(() => { loadPatrols(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!unitId || !sectorId || !startAt || !endAt) return;
    setCreating(true);
    try {
      await patrolsApi.create({
        unitId,
        sectorId,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
      });
      setShowCreate(false);
      setUnitId(''); setSectorId(''); setStartAt(''); setEndAt('');
      loadPatrols();
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  }

  async function handleCancel(id: string) {
    if (cancelling) return;
    if (!confirm('¿Cancelar patrullaje?')) return;
    setCancelling(id);
    try {
      await patrolsApi.cancel(id);
      loadPatrols();
    } catch {
      // ignore
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h3 className="text-xs font-semibold text-slate-gray uppercase tracking-wide">Patrullajes</h3>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="text-xs text-tactical-blue hover:underline"
        >
          {showCreate ? 'Cancelar' : '+ Nuevo'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="p-4 border-b border-slate-800 space-y-2">
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-signal-white text-xs"
          >
            <option value="">— Unidad —</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.callSign}</option>)}
          </select>

          <select
            value={sectorId}
            onChange={(e) => setSectorId(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-signal-white text-xs"
          >
            <option value="">— Sector —</option>
            {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-signal-white text-xs"
            />
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              required
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-signal-white text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full bg-tactical-blue hover:bg-blue-600 disabled:opacity-50 text-white text-xs rounded py-1.5"
          >
            {creating ? 'Asignando...' : 'Asignar patrullaje'}
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
                Sector: {patrol.sector?.name ?? patrol.sectorId.slice(0, 8)}
              </div>
              <div className="text-slate-gray text-xs">
                {new Date(patrol.startAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                {' — '}
                {new Date(patrol.endAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {(patrol.status === 'scheduled' || patrol.status === 'active') && (
                <button
                  onClick={() => handleCancel(patrol.id)}
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
