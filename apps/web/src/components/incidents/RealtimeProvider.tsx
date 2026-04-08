'use client';

import { useEffect } from 'react';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';
import { useUnitsStore } from '@/store/units.store';
import { useIncidentsStore } from '@/store/incidents.store';
import type { UnitPosition, Incident, Unit } from '@/lib/types';
import { useAlertsStore } from '@/store/alerts.store';

export default function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const updatePosition = useUnitsStore((s) => s.updatePosition);
  const updateUnit = useUnitsStore((s) => s.updateUnit);
  const addIncident = useIncidentsStore((s) => s.addIncident);
  const updateIncident = useIncidentsStore((s) => s.updateIncident);
  const addAlert = useAlertsStore((s) => s.addAlert);

  useEffect(() => {
    if (!accessToken) return;

    const socket = connectSocket(accessToken);

    // Join the command room to receive all events
    socket.emit('join:command');

    // Unit location changed
    socket.on('unit:location:changed', (payload: UnitPosition) => {
      updatePosition(payload);
    });

    // Unit status changed — we receive partial data and merge with existing
    socket.on(
      'unit:status:changed',
      (payload: { unitId: string; status: string; previousStatus: string }) => {
        const units = useUnitsStore.getState().units;
        const existing = units.find((u) => u.id === payload.unitId);
        if (existing) {
          updateUnit({ ...existing, status: payload.status as Unit['status'] });
        }
      },
    );

    // New incident created
    socket.on('incident:created', (incident: Incident) => {
      addIncident(incident);
      if (incident.priority === 'critical' || incident.priority === 'high') {
        addAlert({
          folio: incident.folio,
          message: incident.description ?? incident.address ?? 'Nuevo incidente',
          priority: incident.priority,
        });
      }
    });

    // Incident status changed
    socket.on(
      'incident:status:changed',
      (payload: { incidentId: string; status: string }) => {
        const incidents = useIncidentsStore.getState().incidents;
        const incident = incidents.find((i) => i.id === payload.incidentId);
        if (incident) {
          updateIncident({ ...incident, status: payload.status as Incident['status'] });
        }
      },
    );

    // Geofence entered
    socket.on(
      'geofence:entered',
      (payload: { unitId: string; callSign: string; sectorId: string; sectorName: string }) => {
        addAlert({
          folio: payload.callSign,
          message: `Entró a sector: ${payload.sectorName}`,
          priority: 'geofence',
        });
      },
    );

    // Geofence exited
    socket.on(
      'geofence:exited',
      (payload: { unitId: string; callSign: string; sectorId: string; sectorName: string }) => {
        addAlert({
          folio: payload.callSign,
          message: `Salió de sector: ${payload.sectorName}`,
          priority: 'geofence',
        });
      },
    );

    return () => {
      socket.off('unit:location:changed');
      socket.off('unit:status:changed');
      socket.off('incident:created');
      socket.off('incident:status:changed');
      socket.off('geofence:entered');
      socket.off('geofence:exited');
      disconnectSocket();
    };
  }, [accessToken, updatePosition, updateUnit, addIncident, updateIncident, addAlert]);

  return <>{children}</>;
}
