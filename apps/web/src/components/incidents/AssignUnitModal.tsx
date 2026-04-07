'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { useUnitsStore } from '@/store/units.store';
import { useIncidentsStore } from '@/store/incidents.store';
import { dispatchApi } from '@/lib/api';
import { UnitStatus } from '@velnari/shared-types';
import type { BadgeVariant } from '@/components/ui/Badge';

interface AssignUnitModalProps {
  incidentId: string;
  onClose: () => void;
}

export default function AssignUnitModal({ incidentId, onClose }: AssignUnitModalProps) {
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const units = useUnitsStore((s) => s.units);
  const updateIncident = useIncidentsStore((s) => s.updateIncident);

  const availableUnits = units.filter((u) => u.status === UnitStatus.AVAILABLE && u.isActive);

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
        {availableUnits.length === 0 ? (
          <p className="text-slate-gray text-sm text-center py-4">
            Sin unidades disponibles
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {availableUnits.map((unit) => (
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
                      <span className="text-xs text-slate-gray">
                        Turno: {unit.shift}
                      </span>
                    )}
                  </div>
                  <Badge variant={unit.status as unknown as BadgeVariant} />
                </button>
              </li>
            ))}
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
