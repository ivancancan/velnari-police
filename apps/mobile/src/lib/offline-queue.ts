import * as SecureStore from 'expo-secure-store';
import { api } from './api';

interface QueuedAction {
  id: string;
  method: 'post' | 'patch' | 'delete';
  url: string;
  data?: unknown;
  createdAt: number;
}

const QUEUE_KEY = 'velnari_offline_queue';

async function loadQueue(): Promise<QueuedAction[]> {
  try {
    const raw = await SecureStore.getItemAsync(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveQueue(queue: QueuedAction[]): Promise<void> {
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueue(method: 'post' | 'patch' | 'delete', url: string, data?: unknown): Promise<void> {
  const queue = await loadQueue();
  queue.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    method,
    url,
    data,
    createdAt: Date.now(),
  });
  await saveQueue(queue);
}

export async function flushQueue(): Promise<{ success: number; failed: number }> {
  const queue = await loadQueue();
  if (queue.length === 0) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;
  const remaining: QueuedAction[] = [];

  for (const action of queue) {
    try {
      if (action.method === 'post') {
        await api.post(action.url, action.data);
      } else if (action.method === 'patch') {
        await api.patch(action.url, action.data);
      } else if (action.method === 'delete') {
        await api.delete(action.url);
      }
      success++;
    } catch {
      // Keep in queue if less than 24h old
      if (Date.now() - action.createdAt < 86400000) {
        remaining.push(action);
      }
      failed++;
    }
  }

  await saveQueue(remaining);
  return { success, failed };
}

export async function getQueueSize(): Promise<number> {
  const queue = await loadQueue();
  return queue.length;
}
