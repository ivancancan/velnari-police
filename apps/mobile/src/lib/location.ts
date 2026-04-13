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

export async function startLocationTracking(unitId: string): Promise<boolean> {
  _unitId = unitId;

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return false;

  // Battery-conscious tuning:
  // - Accuracy.Balanced (~100m) is plenty for dispatch maps; High drains ~2x.
  // - timeInterval 30s upper bound; the OS still fires sooner if distanceInterval (25m)
  //   is exceeded — so moving units update frequently, stationary ones stay quiet.
  // - Operators viewing the command map get smooth tracks because the API
  //   interpolates between points; officers get hours more runtime per shift.
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 30000,
    distanceInterval: 25,
    foregroundService: {
      notificationTitle: 'Velnari Field activo',
      notificationBody: 'Enviando ubicación al centro de mando.',
    },
    deferredUpdatesInterval: 15000,
    activityType: Location.ActivityType.AutomotiveNavigation,
    pausesUpdatesAutomatically: false,
  });
  return true;
}

export async function stopLocationTracking(): Promise<void> {
  _unitId = null;
  const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (isTracking) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}
