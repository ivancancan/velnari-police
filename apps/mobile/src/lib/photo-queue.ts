import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const QUEUE_KEY = 'velnari_photo_queue';
const PHOTOS_DIR = `${FileSystem.documentDirectory}velnari_photos/`;

const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 30 * 60_000;
const MAX_RETRIES = 8;
const TTL_MS = 24 * 60 * 60_000;

interface QueuedPhoto {
  id: string;
  incidentId: string;
  localUri: string;
  capturedAt: string;
  retryCount: number;
  nextRetryAt: number;
}

function jitter(): number {
  return Math.random() * 5_000;
}

function nextRetryDelay(retryCount: number): number {
  return Math.min(BASE_DELAY_MS * Math.pow(2, retryCount), MAX_DELAY_MS) + jitter();
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

export async function enqueuePhoto(incidentId: string, tempUri: string): Promise<void> {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ext = tempUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const destUri = `${PHOTOS_DIR}${id}.${ext}`;

  await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  await FileSystem.copyAsync({ from: tempUri, to: destUri });

  const queue = await loadQueue();
  queue.push({
    id,
    incidentId,
    localUri: destUri,
    capturedAt: new Date().toISOString(),
    retryCount: 0,
    nextRetryAt: 0,
  });
  await saveQueue(queue);
}

export async function flushPhotoQueue(): Promise<{ success: number; failed: number }> {
  const queue = await loadQueue();
  if (queue.length === 0) return { success: 0, failed: 0 };

  const { incidentsApi } = require('./api') as typeof import('./api');
  const now = Date.now();
  let success = 0;
  let failed = 0;
  const remaining: QueuedPhoto[] = [];

  for (const photo of queue) {
    const createdMs = new Date(photo.capturedAt).getTime();

    if (now - createdMs > TTL_MS || photo.retryCount >= MAX_RETRIES) {
      await FileSystem.deleteAsync(photo.localUri, { idempotent: true });
      continue;
    }

    if (photo.nextRetryAt > now) {
      remaining.push(photo);
      continue;
    }

    const info = await FileSystem.getInfoAsync(photo.localUri);
    if (!info.exists) {
      continue;
    }

    try {
      await incidentsApi.uploadPhotoPresigned(photo.incidentId, photo.localUri);
      await FileSystem.deleteAsync(photo.localUri, { idempotent: true });
      success++;
    } catch {
      failed++;
      remaining.push({
        ...photo,
        retryCount: photo.retryCount + 1,
        nextRetryAt: now + nextRetryDelay(photo.retryCount),
      });
    }
  }

  await saveQueue(remaining);
  return { success, failed };
}

export async function getPhotoQueueSize(): Promise<number> {
  const queue = await loadQueue();
  return queue.length;
}
