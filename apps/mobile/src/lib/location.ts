// apps/mobile/src/lib/location.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import { unitsApi } from './api';

const LOCATION_TASK = 'velnari-location-task';
let _unitId: string | null = null;

// Define the background task
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
  if (error) return;
  const location = data.locations[0];
  if (!location || !_unitId) return;

  const { latitude, longitude } = location.coords;
  let batteryLevel: number | undefined;
  try {
    batteryLevel = await Battery.getBatteryLevelAsync();
  } catch { /* unavailable on some devices */ }

  try {
    await unitsApi.updateLocation(_unitId, latitude, longitude, batteryLevel);
  } catch {
    // Buffer the point for sync when network returns
    try {
      const { storeLocationPoint } = require('./location-queue') as typeof import('./location-queue');
      await storeLocationPoint(_unitId, latitude, longitude);
    } catch { /* storage unavailable — nothing we can do */ }
  }
});

export interface StartTrackingResult {
  ok: boolean;
  reason?: 'foreground_denied' | 'background_denied' | 'start_failed';
  error?: string;
}

export async function startLocationTracking(unitId: string): Promise<StartTrackingResult> {
  _unitId = unitId;

  // Need foreground permission first (baseline).
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { ok: false, reason: 'foreground_denied' };

  // Background permission is what allows startLocationUpdatesAsync to keep
  // sending points with the app backgrounded / screen off. Without it, iOS
  // throws "backgroundLocationUpdates mode is not set" and the updates stop.
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return { ok: false, reason: 'background_denied' };

  try {
    // Battery-conscious tuning:
    // - Accuracy.Balanced (~100m) is plenty for dispatch maps; High drains ~2x.
    // - timeInterval 30s upper bound; the OS still fires sooner if distanceInterval (25m)
    //   is exceeded — so moving units update frequently, stationary ones stay quiet.
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      // Balanced is sufficient for command map (saves ~50% battery vs High).
      // Distance filter ensures updates while moving; standing still keeps quiet.
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15000,       // 15s maximum interval
      distanceInterval: 10,      // or whenever moved 10m — whichever comes first
      foregroundService: {
        notificationTitle: 'Velnari Field activo',
        notificationBody: 'Enviando ubicación al centro de mando.',
        notificationColor: '#3B82F6',
      },
      // Do NOT use deferredUpdatesInterval — it batches iOS updates and causes
      // the trail to appear to stop. Deliver each fix individually.
      activityType: Location.ActivityType.Other, // walking patrol — not automotive
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'start_failed', error: (err as Error).message };
  }
}

export async function stopLocationTracking(): Promise<void> {
  _unitId = null;
  const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (isTracking) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}
