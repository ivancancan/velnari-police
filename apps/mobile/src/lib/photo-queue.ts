import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const QUEUE_KEY = 'velnari_photo_queue';
const PHOTOS_DIR = `${FileSystem.documentDirectory}velnari_photos/`;

interface QueuedPhoto {
  id: string;
  incidentId: string;
  localUri: string;
  capturedAt: string;
}

async function loadQueue(): Promise<QueuedPhoto[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedPhoto[]) : [];
  } catch { return []; }
}

async function saveQueue(queue: QueuedPhoto[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Copies a temp image URI to permanent app storage and queues it for upload.
 * Call this when the network is unavailable or after incident creation completes.
 */
export async function enqueuePhoto(incidentId: string, tempUri: string): Promise<void> {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ext = tempUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const destUri = `${PHOTOS_DIR}${id}.${ext}`;

  // Ensure permanent directory exists
  await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  // Copy from temp location (picker URI) to permanent storage
  await FileSystem.copyAsync({ from: tempUri, to: destUri });

  const queue = await loadQueue();
  queue.push({ id, incidentId, localUri: destUri, capturedAt: new Date().toISOString() });
  await saveQueue(queue);
}

/**
 * Uploads all queued photos. Returns counts.
 * Stops on first network failure (still offline) to avoid hammering the server.
 */
export async function flushPhotoQueue(): Promise<{ success: number; failed: number }> {
  const queue = await loadQueue();
  if (queue.length === 0) return { success: 0, failed: 0 };

  // Lazy import to break circular dep (api -> photo-queue -> api)
  const { incidentsApi } = require('./api') as typeof import('./api');

  let success = 0;
  let failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const photo = queue[i]!;

    // Verify file still exists (could have been cleared by OS)
    const info = await FileSystem.getInfoAsync(photo.localUri);
    if (!info.exists) {
      // File gone — drop from queue silently, continue to next
      continue;
    }

    try {
      await incidentsApi.uploadPhoto(photo.incidentId, photo.localUri);
      // Delete local copy after successful upload
      await FileSystem.deleteAsync(photo.localUri, { idempotent: true });
      success++;
    } catch {
      failed++;
      // Still offline — keep this photo and all remaining ones
      await saveQueue(queue.slice(i));
      return { success, failed };
    }
  }

  // All photos processed (uploaded or file-gone) — clear queue
  await saveQueue([]);
  return { success, failed };
}

export async function getPhotoQueueSize(): Promise<number> {
  const queue = await loadQueue();
  return queue.length;
}
