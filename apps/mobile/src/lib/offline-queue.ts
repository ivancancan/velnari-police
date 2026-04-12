import * as SecureStore from 'expo-secure-store';

interface QueuedAction {
  id: string;
  method: 'post' | 'patch' | 'delete';
  url: string;
  data?: unknown;
  createdAt: number;
  retryCount: number;
  nextRetryAt: number;
}

const QUEUE_KEY = 'velnari_offline_queue';
const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 30 * 60_000;
const MAX_RETRIES = 8;
const TTL_MS = 24 * 60 * 60_000;

function jitter(): number {
  return Math.random() * 5_000;
}

function nextRetryDelay(retryCount: number): number {
  const exponential = BASE_DELAY_MS * Math.pow(2, retryCount);
  return Math.min(exponential, MAX_DELAY_MS) + jitter();
}

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
    retryCount: 0,
    nextRetryAt: 0,
  });
  await saveQueue(queue);
}

export async function flushQueue(): Promise<{ success: number; failed: number }> {
  const queue = await loadQueue();
  if (queue.length === 0) return { success: 0, failed: 0 };

  const now = Date.now();
  let success = 0;
  let failed = 0;
  const remaining: QueuedAction[] = [];

  const { api } = require('./api');

  for (const action of queue) {
    if (now - action.createdAt > TTL_MS || action.retryCount >= MAX_RETRIES) {
      continue;
    }

    if (action.nextRetryAt > now) {
      remaining.push(action);
      continue;
    }

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
      failed++;
      remaining.push({
        ...action,
        retryCount: action.retryCount + 1,
        nextRetryAt: now + nextRetryDelay(action.retryCount),
      });
    }
  }

  await saveQueue(remaining);
  return { success, failed };
}

export async function getQueueSize(): Promise<number> {
  const queue = await loadQueue();
  return queue.length;
}

export async function clearQueue(): Promise<void> {
  await SecureStore.deleteItemAsync(QUEUE_KEY);
}
