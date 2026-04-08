// apps/mobile/src/store/unit.store.ts
import { create } from 'zustand';

interface AssignedIncident {
  id: string;
  folio: string;
  type: string;
  priority: string;
  status: string;
  address?: string;
  description?: string;
}

interface UnitState {
  unitId: string | null;
  callSign: string | null;
  status: string;
  assignedIncident: AssignedIncident | null;
  setUnit: (unitId: string, callSign: string, status: string) => void;
  setStatus: (status: string) => void;
  setAssignedIncident: (incident: AssignedIncident | null) => void;
}

export const useUnitStore = create<UnitState>((set) => ({
  unitId: null,
  callSign: null,
  status: 'available',
  assignedIncident: null,
  setUnit: (unitId, callSign, status) => set({ unitId, callSign, status }),
  setStatus: (status) => set({ status }),
  setAssignedIncident: (incident) => set({ assignedIncident: incident }),
}));
