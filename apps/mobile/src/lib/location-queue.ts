import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'velnari_location_queue';
const MAX_POINTS = 20;          // Max buffered points — oldest dropped when exceeded
const DEDUP_WINDOW_MS = 60_000; // Keep at most 1 point per 60-second window

interface LocationPoint {
  unitId: string;
  lat: number;
  lng: number;
  timestamp: number;
}

async function loadQueue(): Promise<LocationPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as LocationPoint[]) : [];
  } catch { return []; }
}

async function saveQueue(queue: LocationPoint[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Stores a GPS point captured while offline.
 * Deduplication: replaces the last point if within the same 60-second window.
 * Caps total buffered points at MAX_POINTS (drops oldest).
 */
export async function storeLocationPoint(unitId: string, lat: number, lng: number): Promise<void> {
  const queue = await loadQueue();
  const now = Date.now();
  const last = queue[queue.length - 1];

  if (last && now - last.timestamp < DEDUP_WINDOW_MS) {
    // Replace the last point — one sample per minute is sufficient
    queue[queue.length - 1] = { unitId, lat, lng, timestamp: now };
  } else {
    queue.push({ unitId, lat, lng, timestamp: now });
  }

  // Trim to MAX_POINTS keeping the most recent
  await saveQueue(queue.slice(-MAX_POINTS));
}

/**
 * Sends all buffered location points to the API in chronological order.
 * Stops at first failure (still offline). Removes sent points from the queue.
 */
export async function flushLocationQueue(): Promise<{ sent: number }> {
  const queue = await loadQueue();
  if (queue.length === 0) return { sent: 0 };

  // Lazy import
  const { unitsApi } = require('./api') as typeof import('./api');

  let sent = 0;

  for (let i = 0; i < queue.length; i++) {
    try {
      const point = queue[i]!;
      await unitsApi.updateLocation(point.unitId, point.lat, point.lng);
      sent++;
    } catch {
      // Still offline — keep this point and everything after it
      await saveQueue(queue.slice(i));
      return { sent };
    }
  }

  await saveQueue([]);
  return { sent };
}

export async function getLocationQueueSize(): Promise<number> {
  const queue = await loadQueue();
  return queue.length;
}
