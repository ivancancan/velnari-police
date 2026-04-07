import { create } from 'zustand';

export interface Alert {
  id: string;
  folio: string;
  message: string;
  priority: string;
  createdAt: number;
}

interface AlertsState {
  alerts: Alert[];
  addAlert: (alert: Omit<Alert, 'id' | 'createdAt'>) => void;
  dismissAlert: (id: string) => void;
}

export const useAlertsStore = create<AlertsState>()((set) => ({
  alerts: [],

  addAlert: (alert) =>
    set((state) => ({
      alerts: [
        ...state.alerts,
        { ...alert, id: crypto.randomUUID(), createdAt: Date.now() },
      ],
    })),

  dismissAlert: (id) =>
    set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),
}));
