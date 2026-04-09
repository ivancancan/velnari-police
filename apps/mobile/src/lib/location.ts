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
    // silently fail — will retry on next ping
  }
});

export async function startLocationTracking(unitId: string): Promise<boolean> {
  _unitId = unitId;

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return false;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 10000,
    distanceInterval: 10,
    foregroundService: {
      notificationTitle: 'Velnari Field activo',
      notificationBody: 'Enviando ubicación al centro de mando.',
    },
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
