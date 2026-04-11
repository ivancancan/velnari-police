import { create } from 'zustand';

export type AlertSeverity = 'critical' | 'high' | 'geofence' | 'stale' | 'info';

export interface Alert {
  id: string;
  folio: string;
  message: string;
  priority: string;
  createdAt: number;
}

interface AlertsState {
  alerts: Alert[];
  history: Alert[];
  unreadCount: number;
  socketConnected: boolean;
  addAlert: (alert: Omit<Alert, 'id' | 'createdAt'>) => void;
  dismissAlert: (id: string) => void;
  markAllRead: () => void;
  setSocketConnected: (v: boolean) => void;
}

export const useAlertsStore = create<AlertsState>()((set) => ({
  alerts: [],
  history: [],
  unreadCount: 0,
  socketConnected: false,

  addAlert: (alert) =>
    set((state) => {
      const newAlert = { ...alert, id: crypto.randomUUID(), createdAt: Date.now() };
      return {
        alerts: [...state.alerts, newAlert],
        history: [newAlert, ...state.history].slice(0, 100),
        unreadCount: state.unreadCount + 1,
      };
    }),

  dismissAlert: (id) =>
    set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),

  markAllRead: () => set({ unreadCount: 0 }),

  setSocketConnected: (v) => set({ socketConnected: v }),
}));
