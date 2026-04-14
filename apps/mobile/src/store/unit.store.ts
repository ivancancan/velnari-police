import { create } from 'zustand';

interface AssignedIncident {
  id: string;
  folio: string;
  type: string;
  priority: string;
  status: string;
  address?: string;
  description?: string;
  etaMinutes?: number | null;
}

interface UnitState {
  unitId: string | null;
  callSign: string | null;
  status: string;
  assignedIncident: AssignedIncident | null;
  pendingAssignments: AssignedIncident[];
  focusCoords: { lat: number; lng: number } | null;
  setUnit: (unitId: string, callSign: string, status: string) => void;
  setStatus: (status: string) => void;
  setAssignedIncident: (incident: AssignedIncident | null) => void;
  nearbyUnits: { id: string; callSign: string; status: string; lat: number; lng: number }[];
  setNearbyUnits: (units: { id: string; callSign: string; status: string; lat: number; lng: number }[]) => void;
  updateNearbyUnitPosition: (unitId: string, lat: number, lng: number) => void;
  addPendingAssignment: (incident: AssignedIncident) => void;
  clearPendingAssignment: (incidentId: string) => void;
  setFocusCoords: (coords: { lat: number; lng: number } | null) => void;
}

export const useUnitStore = create<UnitState>((set) => ({
  unitId: null,
  callSign: null,
  status: 'available',
  assignedIncident: null,
  pendingAssignments: [],
  nearbyUnits: [],
  focusCoords: null,
  setNearbyUnits: (units) => set({ nearbyUnits: units }),
  updateNearbyUnitPosition: (unitId, lat, lng) =>
    set((state) => ({
      nearbyUnits: state.nearbyUnits.map((u) =>
        u.id === unitId ? { ...u, lat, lng } : u,
      ),
    })),
  setUnit: (unitId, callSign, status) => set({ unitId, callSign, status }),
  setStatus: (status) => set({ status }),
  setAssignedIncident: (incident) => set({ assignedIncident: incident }),
  addPendingAssignment: (incident) =>
    set((state) => ({
      pendingAssignments: [...state.pendingAssignments, incident],
    })),
  clearPendingAssignment: (incidentId) =>
    set((state) => ({
      pendingAssignments: state.pendingAssignments.filter((i) => i.id !== incidentId),
    })),
  setFocusCoords: (coords) => set({ focusCoords: coords }),
}));
