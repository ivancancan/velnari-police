import { create } from 'zustand';
import type { Unit, UnitPosition } from '@/lib/types';

interface UnitsState {
  units: Unit[];
  positions: Record<string, UnitPosition>;
  trails: Record<string, [number, number][]>; // unitId → [[lng, lat], ...]
  trailStarts: Record<string, [number, number]>; // unitId → [lng, lat] first point
  isLoading: boolean;
  selectedUnitId: string | null;
  setUnits: (units: Unit[]) => void;
  updateUnit: (updated: Unit) => void;
  updatePosition: (position: UnitPosition) => void;
  setLoading: (loading: boolean) => void;
  selectUnit: (id: string | null) => void;
  insideSectors: Record<string, string[]>;
  setUnitInsideSectors: (unitId: string, sectorIds: string[]) => void;
  /** Clears all live trails + starts from the command map. Does NOT touch
   *  server-side history — only the in-memory breadcrumb overlay. */
  clearTrails: () => void;
}

const MAX_TRAIL_POINTS = 200;

export const useUnitsStore = create<UnitsState>()((set) => ({
  units: [],
  positions: {},
  trails: {},
  trailStarts: {},
  isLoading: false,
  selectedUnitId: null,
  insideSectors: {},

  setUnits: (units) => {
    const positions: Record<string, UnitPosition> = {};
    for (const u of units) {
      if (u.lat != null && u.lng != null) {
        positions[u.id] = {
          unitId: u.id,
          lat: u.lat,
          lng: u.lng,
          timestamp: u.lastLocationAt ?? new Date().toISOString(),
        };
      }
    }
    set((state) => ({ units, positions: { ...positions, ...state.positions } }));
  },

  updateUnit: (updated) =>
    set((state) => ({
      units: state.units.map((u) => (u.id === updated.id ? updated : u)),
    })),

  updatePosition: (position) =>
    set((state) => {
      const trail = state.trails[position.unitId] ?? [];
      const newPoint: [number, number] = [position.lng, position.lat];
      const updatedTrail = [...trail, newPoint].slice(-MAX_TRAIL_POINTS);
      // Record start point (first GPS ping of this session)
      const trailStarts = { ...state.trailStarts };
      if (!trailStarts[position.unitId]) {
        trailStarts[position.unitId] = newPoint;
      }
      return {
        positions: { ...state.positions, [position.unitId]: position },
        trails: { ...state.trails, [position.unitId]: updatedTrail },
        trailStarts,
      };
    }),

  setLoading: (isLoading) => set({ isLoading }),

  selectUnit: (id) => set({ selectedUnitId: id }),

  setUnitInsideSectors: (unitId, sectorIds) =>
    set((state) => ({
      insideSectors: { ...state.insideSectors, [unitId]: sectorIds },
    })),

  clearTrails: () => set({ trails: {}, trailStarts: {} }),
}));
