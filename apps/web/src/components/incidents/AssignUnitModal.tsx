'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { useUnitsStore } from '@/store/units.store';
import { useIncidentsStore } from '@/store/incidents.store';
import { dispatchApi, unitsApi } from '@/lib/api';
import { UnitStatus } from '@velnari/shared-types';
import type { BadgeVariant } from '@/components/ui/Badge';
import type { UnitWithDistance, Unit } from '@/lib/types';
import { Check } from 'lucide-react';

interface AssignUnitModalProps {
  incidentId: string;
  onClose: () => void;
}

export default function AssignUnitModal({ incidentId, onClose }: AssignUnitModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dispatching, setDispatching] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nearbyUnits, setNearbyUnits] = useState<UnitWithDistance[] | null>(null);

  const units = useUnitsStore((s) => s.units);
  const updateIncident = useIncidentsStore((s) => s.updateIncident);
  const incidents = useIncidentsStore((s) => s.incidents);

  const incident = incidents.find((i) => i.id === incidentId);

  useEffect(() => {
    if (!incident?.lat || !incident?.lng) return;
    unitsApi
      .getNearby(incident.lat, incident.lng)
      .then((res) => setNearbyUnits(res.data))
      .catch(() => setNearbyUnits(null));
  }, [incident?.lat, incident?.lng]);

  const fallbackUnits: Unit[] = units.filter(
    (u) => u.status === UnitStatus.AVAILABLE && u.isActive,
  );

  const displayUnits: (UnitWithDistance | Unit)[] = nearbyUnits ?? fallbackUnits;

  function toggleUnit(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const handleDispatch = async () => {
    if (selected.size === 0 || dispatching) return;
    setDispatching(true);
    setError(null);

    const ids = Array.from(selected);
    let lastResult = null;

    for (let i = 0; i < ids.length; i++) {
      const unitId = ids[i]!;
      const unit = displayUnits.find(u => u.id === unitId);
      setProgress(`Despachando ${unit?.callSign ?? unitId} (${i + 1}/${ids.length})…`);
      try {
        const res = await dispatchApi.assignUnit(incidentId, unitId);
        lastResult = res.data;
      } catch {
        setError(`Error al asignar ${unit?.callSign ?? unitId}`);
        setDispatching(false);
        setProgress(null);
        return;
      }
    }

    if (lastResult) updateIncident(lastResult);
    onClose();
  };

  return (
    <Modal isOpen title="Asignar unidades" onClose={onClose}>
      <div className="flex flex-col gap-3">
        {nearbyUnits !== null && (
          <p className="text-xs text-slate-gray text-center">
            Unidades disponibles más cercanas al incidente
          </p>
        )}

        {displayUnits.length === 0 ? (
          <p className="text-slate-gray text-sm text-center py-4">
            Sin unidades disponibles
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {displayUnits.map((unit) => {
              const dist = 'distanceKm' in unit ? unit.distanceKm : null;
              const isSelected = selected.has(unit.id);
              return (
                <li key={unit.id}>
                  <button
                    onClick={() => toggleUnit(unit.id)}
                    disabled={dispatching}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded border transition-colors ${
                      isSelected
                        ? 'bg-tactical-blue/20 border-tactical-blue'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700'
                    } disabled:opacity-50`}
                    aria-label={`Seleccionar ${unit.callSign}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                        isSelected ? 'bg-tactical-blue border-tactical-blue' : 'border-slate-600'
                      }`}>
                        {isSelected && <Check size={10} className="text-white" />}
                      </div>
                      <span className="font-mono font-bold text-signal-white">
                        {unit.callSign}
                      </span>
                      {unit.shift && (
                        <span className="text-xs text-slate-gray">Turno: {unit.shift}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {dist !== null && (
                        <span className="text-xs font-mono text-tactical-blue bg-slate-700 px-2 py-0.5 rounded">
                          {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}
                        </span>
                      )}
                      <Badge variant={unit.status as BadgeVariant} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {progress && <p className="text-tactical-blue text-xs text-center animate-pulse">{progress}</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-2 mt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-slate-gray hover:text-signal-white text-sm transition-colors border border-slate-700 rounded hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleDispatch}
            disabled={selected.size === 0 || dispatching}
            className="flex-1 py-2 bg-tactical-blue hover:bg-blue-600 text-white text-sm font-semibold rounded disabled:opacity-40 transition-colors"
          >
            {dispatching ? 'Despachando…' : `Despachar ${selected.size > 0 ? `(${selected.size})` : ''}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
