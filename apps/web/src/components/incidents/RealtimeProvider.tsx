'use client';

import { useEffect, useRef, useCallback } from 'react';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';
import { useUnitsStore } from '@/store/units.store';
import { useIncidentsStore } from '@/store/incidents.store';
import type { UnitPosition, Incident, Unit } from '@/lib/types';
import { useAlertsStore } from '@/store/alerts.store';

// How long a unit can go without moving before we alert (ms)
const STALE_THRESHOLD_MS = 5 * 60_000; // 5 minutes
const STALE_CHECK_INTERVAL_MS = 60_000; // check every minute

// Per-priority alert tones so the operator can distinguish severity by ear
// even if the screen isn't in view. Frequencies ascend with urgency.
const PRIORITY_TONES: Record<string, { freq: number; decayMs: number; double?: boolean }> = {
  critical: { freq: 1320, decayMs: 600, double: true },
  high:     { freq: 880,  decayMs: 500 },
  medium:   { freq: 660,  decayMs: 300 },
  low:      { freq: 440,  decayMs: 250 },
  geofence: { freq: 740,  decayMs: 400 },
};

function playAlertSound(priority: string = 'high') {
  try {
    const cfg = PRIORITY_TONES[priority] ?? PRIORITY_TONES['high']!;
    const ctx = new AudioContext();

    const fire = (delay: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = cfg.freq;
      osc.type = 'square';
      gain.gain.value = 0.15;
      osc.start(ctx.currentTime + delay);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + cfg.decayMs / 1000);
      osc.stop(ctx.currentTime + delay + cfg.decayMs / 1000);
    };

    fire(0);
    if (cfg.double) fire(0.25);
  } catch { /* no audio context available */ }
}

export default function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const updatePosition = useUnitsStore((s) => s.updatePosition);
  const updateUnit = useUnitsStore((s) => s.updateUnit);
  const addIncident = useIncidentsStore((s) => s.addIncident);
  const updateIncident = useIncidentsStore((s) => s.updateIncident);
  const addAlert = useAlertsStore((s) => s.addAlert);
  const setSocketConnected = useAlertsStore((s) => s.setSocketConnected);

  // Track last movement time per unit
  const lastMoveRef = useRef<Record<string, number>>({});
  // Track which units already have stale alerts (prevent spam)
  const staleAlertedRef = useRef<Set<string>>(new Set());
  // Track which units already have battery alerts
  const batteryAlertedRef = useRef<Set<string>>(new Set());

  const handleAlert = useCallback((priority: string, folio: string, message: string) => {
    addAlert({ folio, message, priority });
    if (priority === 'critical' || priority === 'high' || priority === 'geofence' || priority === 'medium') {
      playAlertSound(priority);
    }
  }, [addAlert]);

  useEffect(() => {
    if (!accessToken) return;

    const socket = connectSocket(accessToken);

    // Track connection state
    setSocketConnected(socket.connected);
    socket.on('connect', () => {
      setSocketConnected(true);
      // Re-join command room after reconnect
      socket.emit('join:command');
    });
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));
    socket.on('reconnect_attempt', (attempt: number) => {
      const delaySec = Math.min(Math.pow(2, attempt - 1), 30);
      console.warn(`[socket] reconnect attempt #${attempt}, next in ~${delaySec}s`);
    });

    socket.emit('join:command');

    // Unit location changed
    socket.on('unit:location:changed', (payload: UnitPosition) => {
      updatePosition(payload);
      // Track movement
      lastMoveRef.current[payload.unitId] = Date.now();
      staleAlertedRef.current.delete(payload.unitId);

      // Battery low alert
      if (payload.batteryLevel != null && payload.batteryLevel < 0.15) {
        if (!batteryAlertedRef.current.has(payload.unitId)) {
          batteryAlertedRef.current.add(payload.unitId);
          const units = useUnitsStore.getState().units;
          const unit = units.find((u) => u.id === payload.unitId);
          handleAlert('critical', unit?.callSign ?? payload.unitId,
            `🔋 Batería baja: ${Math.round(payload.batteryLevel * 100)}%`);
        }
      } else if (payload.batteryLevel != null && payload.batteryLevel >= 0.2) {
        batteryAlertedRef.current.delete(payload.unitId);
      }
    });

    // Unit status changed
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
        handleAlert(incident.priority, incident.folio,
          incident.description ?? incident.address ?? 'Nuevo incidente');
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

    // Incident closed — update status in store and notify operators
    socket.on(
      'incident:closed',
      (payload: { incidentId: string; resolution: string }) => {
        const incidents = useIncidentsStore.getState().incidents;
        const incident = incidents.find((i) => i.id === payload.incidentId);
        if (incident) {
          updateIncident({ ...incident, status: 'closed' as Incident['status'] });
          addAlert({
            folio: incident.folio,
            message: `Cerrado · ${payload.resolution}`,
            priority: 'low',
          });
        }
      },
    );

    // Server-side GPS stale alert
    socket.on(
      'unit:gps:stale',
      (payload: { unitId: string; callSign: string; minutesSinceLastPing: number | null }) => {
        const label = payload.minutesSinceLastPing != null
          ? `Sin GPS hace ${payload.minutesSinceLastPing} min`
          : 'Sin señal GPS';
        addAlert({ folio: payload.callSign, message: label, priority: 'stale' });
      },
    );

    // Geofence entered
    socket.on(
      'geofence:entered',
      (payload: { unitId: string; callSign: string; sectorId: string; sectorName: string }) => {
        handleAlert('geofence', payload.callSign,
          `Entró a sector: ${payload.sectorName}`);
      },
    );

    // Geofence exited — this is the critical one
    socket.on(
      'geofence:exited',
      (payload: { unitId: string; callSign: string; sectorId: string; sectorName: string }) => {
        // Check if unit left its assigned sector
        const units = useUnitsStore.getState().units;
        const unit = units.find((u) => u.id === payload.unitId);
        const isAssignedSector = unit?.sectorId === payload.sectorId;

        handleAlert('geofence', payload.callSign,
          isAssignedSector
            ? `⚠ SALIÓ DE SU ZONA ASIGNADA: ${payload.sectorName}`
            : `Salió de sector: ${payload.sectorName}`);

        if (isAssignedSector) {
          playAlertSound(); // double sound for leaving assigned zone
        }
      },
    );

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('reconnect_attempt');
      socket.off('unit:gps:stale');
      socket.off('unit:location:changed');
      socket.off('unit:status:changed');
      socket.off('incident:created');
      socket.off('incident:status:changed');
      socket.off('incident:closed');
      socket.off('geofence:entered');
      socket.off('geofence:exited');
      disconnectSocket();
      setSocketConnected(false);
    };
  }, [accessToken, updatePosition, updateUnit, addIncident, updateIncident, handleAlert, setSocketConnected]);

  // Stale unit detection — check every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const units = useUnitsStore.getState().units;
      const positions = useUnitsStore.getState().positions;

      for (const unit of units) {
        // Only check units that are actively tracking (have a position)
        if (!positions[unit.id]) continue;
        // Only check available/en_route/on_scene (not out_of_service)
        if (unit.status === 'out_of_service') continue;

        const lastMove = lastMoveRef.current[unit.id];
        if (!lastMove) {
          // First time seeing this unit — set baseline
          lastMoveRef.current[unit.id] = now;
          continue;
        }

        const elapsed = now - lastMove;
        if (elapsed >= STALE_THRESHOLD_MS && !staleAlertedRef.current.has(unit.id)) {
          staleAlertedRef.current.add(unit.id);
          const mins = Math.round(elapsed / 60_000);
          addAlert({
            folio: unit.callSign,
            message: `Sin movimiento hace ${mins} minutos`,
            priority: 'stale',
          });
          playAlertSound();
        }
      }
    }, STALE_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [addAlert]);

  return <>{children}</>;
}
