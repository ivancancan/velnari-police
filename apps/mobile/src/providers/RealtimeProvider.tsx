import { useEffect, useRef } from 'react';
import { AppState, Vibration } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';
import { useUnitStore } from '@/store/unit.store';
import { sendLocalNotification } from '@/lib/notifications';
import { incidentsApi } from '@/lib/api';

export default function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const unitId = useUnitStore((s) => s.unitId);
  const setStatus = useUnitStore((s) => s.setStatus);
  const addPendingAssignment = useUnitStore((s) => s.addPendingAssignment);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!accessToken) return;

    const socket = connectSocket(accessToken);

    // Join command room for general awareness
    socket.emit('join:command');

    // Join unit-specific room if we have a unitId
    if (unitId) {
      socket.emit('join:unit', { unitId });
    }

    // Connection status logging
    socket.on('connect', () => {
      // Re-join rooms on reconnect
      socket.emit('join:command');
      if (unitId) {
        socket.emit('join:unit', { unitId });
      }
    });

    // Incident assigned to this unit
    socket.on('incident:assigned', async (payload: { incidentId: string; unitId: string; etaMinutes: number | null }) => {
      const currentUnitId = useUnitStore.getState().unitId;
      if (payload.unitId !== currentUnitId) return;

      // Fetch the full incident details
      try {
        const { data: incidents } = await incidentsApi.getAll();
        const incident = incidents.find((i) => i.id === payload.incidentId);
        if (incident) {
          addPendingAssignment({
            ...incident,
            etaMinutes: payload.etaMinutes,
          });

          // Vibrate to alert officer
          Vibration.vibrate([0, 500, 200, 500]);

          // Send local notification (works even if app is backgrounded)
          await sendLocalNotification(
            `Incidente asignado: ${incident.folio}`,
            `${incident.type} — ${incident.address ?? 'Sin dirección'}`,
          );
        }
      } catch {
        // If fetch fails, still notify with basic info
        await sendLocalNotification(
          'Nuevo incidente asignado',
          'Abre la app para ver los detalles.',
        );
      }
    });

    // Unit status changed externally (e.g., by command center)
    socket.on('unit:status:changed', (payload: { unitId: string; status: string }) => {
      const currentUnitId = useUnitStore.getState().unitId;
      if (payload.unitId === currentUnitId) {
        setStatus(payload.status);
      }
    });

    // Incident closed
    socket.on('incident:closed', (payload: { incidentId: string }) => {
      const state = useUnitStore.getState();
      if (state.assignedIncident?.id === payload.incidentId) {
        useUnitStore.getState().setAssignedIncident(null);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('incident:assigned');
      socket.off('unit:status:changed');
      socket.off('incident:closed');
      disconnectSocket();
    };
  }, [accessToken, unitId, setStatus, addPendingAssignment]);

  // Reconnect socket when app comes back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        const token = useAuthStore.getState().accessToken;
        if (token) {
          connectSocket(token);
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  return <>{children}</>;
}
