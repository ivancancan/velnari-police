import { create } from 'zustand';
import type { Unit, UnitPosition } from '@/lib/types';

interface UnitsState {
  units: Unit[];
  positions: Record<string, UnitPosition>;
  isLoading: boolean;
  selectedUnitId: string | null;
  setUnits: (units: Unit[]) => void;
  updateUnit: (updated: Unit) => void;
  updatePosition: (position: UnitPosition) => void;
  setLoading: (loading: boolean) => void;
  selectUnit: (id: string | null) => void;
}

export const useUnitsStore = create<UnitsState>()((set) => ({
  units: [],
  positions: {},
  isLoading: false,
  selectedUnitId: null,

  setUnits: (units) => set({ units }),

  updateUnit: (updated) =>
    set((state) => ({
      units: state.units.map((u) => (u.id === updated.id ? updated : u)),
    })),

  updatePosition: (position) =>
    set((state) => ({
      positions: { ...state.positions, [position.unitId]: position },
    })),

  setLoading: (isLoading) => set({ isLoading }),

  selectUnit: (id) => set({ selectedUnitId: id }),
}));
