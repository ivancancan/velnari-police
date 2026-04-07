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

interface AssignUnitModalProps {
  incidentId: string;
  onClose: () => void;
}

export default function AssignUnitModal({ incidentId, onClose }: AssignUnitModalProps) {
  const [assigning, setAssigning] = useState<string | null>(null);
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

  const handleAssign = async (unitId: string, callSign: string) => {
    setAssigning(unitId);
    setError(null);
    try {
      const res = await dispatchApi.assignUnit(incidentId, unitId);
      updateIncident(res.data);
      onClose();
    } catch {
      setError(`No se pudo asignar la unidad ${callSign}.`);
    } finally {
      setAssigning(null);
    }
  };

  return (
    <Modal isOpen title="Asignar unidad" onClose={onClose}>
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
              return (
                <li key={unit.id}>
                  <button
                    onClick={() => handleAssign(unit.id, unit.callSign)}
                    disabled={assigning !== null}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded border border-slate-700 transition-colors"
                    aria-label={`Asignar ${unit.callSign}`}
                  >
                    <div className="flex items-center gap-3">
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

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={onClose}
          className="mt-2 text-slate-gray hover:text-signal-white text-sm transition-colors"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  );
}
