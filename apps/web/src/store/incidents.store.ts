import { create } from 'zustand';
import type { Incident } from '@/lib/types';

interface IncidentsState {
  incidents: Incident[];
  selectedId: string | null;
  isLoading: boolean;
  filters: { status: string | null; sectorId: string | null };
  setFilters: (filters: Partial<{ status: string | null; sectorId: string | null }>) => void;
  setIncidents: (incidents: Incident[]) => void;
  addIncident: (incident: Incident) => void;
  updateIncident: (updated: Incident) => void;
  selectIncident: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useIncidentsStore = create<IncidentsState>()((set) => ({
  incidents: [],
  selectedId: null,
  isLoading: false,

  setIncidents: (incidents) => set({ incidents }),

  addIncident: (incident) =>
    set((state) => ({ incidents: [incident, ...state.incidents] })),

  updateIncident: (updated) =>
    set((state) => ({
      incidents: state.incidents.map((i) => (i.id === updated.id ? updated : i)),
    })),

  selectIncident: (selectedId) => set({ selectedId }),

  setLoading: (isLoading) => set({ isLoading }),

  filters: { status: null, sectorId: null },
  setFilters: (f) =>
    set((state) => ({ filters: { ...state.filters, ...f } })),
}));
