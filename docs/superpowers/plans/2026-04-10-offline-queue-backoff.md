# Offline Queue Retry Backoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add jittered exponential backoff to `flushQueue()` and `flushPhotoQueue()` so that when 20 patrol units reconnect simultaneously after an outage, they don't all hammer the API with retries at the same moment. Items that recently failed are skipped until their `nextRetryAt` timestamp passes.

**Architecture:** Add `retryCount: number` and `nextRetryAt: number` (Unix ms) to each queue item. On flush failure, increment `retryCount` and compute `nextRetryAt = now + min(30s * 2^retryCount, 30min) + jitter(0–5s)`. On flush, skip items where `nextRetryAt > now`. Drop items after 24 h or 8 retries. Photo queue gets the same treatment by adding the same fields to `QueuedPhoto`.

**Tech Stack:** `AsyncStorage` (`photo-queue`), `SecureStore` (`offline-queue`), pure TypeScript math.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/mobile/src/lib/offline-queue.ts` | Modify | Add backoff fields to `QueuedAction`, update `flushQueue` |
| `apps/mobile/src/lib/photo-queue.ts` | Modify | Add backoff fields to `QueuedPhoto`, update `flushPhotoQueue` |

---

### Task 1: Add backoff to offline-queue.ts

**Files:**
- Modify: `apps/mobile/src/lib/offline-queue.ts`

Current `QueuedAction` interface:
```typescript
interface QueuedAction {
  id: string;
  method: 'post' | 'patch' | 'delete';
  url: string;
  data?: unknown;
  createdAt: number;
}
```

Current `flushQueue` iterates all items, keeps failures <24h old, no backoff.

- [ ] **Step 1: Read the current offline-queue.ts**

Read `apps/mobile/src/lib/offline-queue.ts` to confirm the exact current implementation.

- [ ] **Step 2: Rewrite offline-queue.ts with backoff**

Replace the entire file contents with:

```typescript
import * as SecureStore from 'expo-secure-store';

interface QueuedAction {
  id: string;
  method: 'post' | 'patch' | 'delete';
  url: string;
  data?: unknown;
  createdAt: number;
  retryCount: number;
  nextRetryAt: number;  // Unix ms — skip this item until this timestamp
}

const QUEUE_KEY = 'velnari_offline_queue';
const BASE_DELAY_MS = 30_000;          // 30 s
const MAX_DELAY_MS = 30 * 60_000;     // 30 min
const MAX_RETRIES = 8;
const TTL_MS = 24 * 60 * 60_000;      // 24 h

function jitter(): number {
  // Uniform 0–5 s to spread reconnect storms across units
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
    nextRetryAt: 0,  // Ready to send immediately
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

  // Lazy import to break circular dependency (api -> offline-queue -> api)
  const { api } = require('./api');

  for (const action of queue) {
    // Drop expired items (too old or too many retries)
    if (now - action.createdAt > TTL_MS || action.retryCount >= MAX_RETRIES) {
      continue; // Drop silently — too old or exhausted
    }

    // Skip items in backoff window
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
      // Success — do NOT push to remaining (item is done)
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
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "offline-queue\|QueuedAction" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/offline-queue.ts
git commit -m "feat(mobile): jittered exponential backoff in offline action queue"
```

---

### Task 2: Add backoff to photo-queue.ts

**Files:**
- Modify: `apps/mobile/src/lib/photo-queue.ts`

Current `QueuedPhoto` interface has no retry fields. `flushPhotoQueue` stops at first failure with `await saveQueue(queue.slice(i)); return`.

- [ ] **Step 1: Read the current photo-queue.ts**

Read `apps/mobile/src/lib/photo-queue.ts` to confirm the exact current implementation.

- [ ] **Step 2: Rewrite photo-queue.ts with backoff**

Replace the entire file contents with:

```typescript
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

/**
 * Copies a temp image URI to permanent app storage and queues it for upload.
 */
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

/**
 * Uploads queued photos with jittered exponential backoff.
 * Skips items in backoff window. Drops expired/exhausted items.
 */
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

    // Drop expired or exhausted items
    if (now - createdMs > TTL_MS || photo.retryCount >= MAX_RETRIES) {
      // Also clean up local file
      await FileSystem.deleteAsync(photo.localUri, { idempotent: true });
      continue;
    }

    // Skip if still in backoff window
    if (photo.nextRetryAt > now) {
      remaining.push(photo);
      continue;
    }

    // Verify file still exists
    const info = await FileSystem.getInfoAsync(photo.localUri);
    if (!info.exists) {
      continue; // File gone — drop from queue
    }

    try {
      await incidentsApi.uploadPhoto(photo.incidentId, photo.localUri);
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
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "photo-queue\|QueuedPhoto" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/photo-queue.ts
git commit -m "feat(mobile): jittered exponential backoff in photo upload queue"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Both queues updated ✓, jitter added ✓, max retries cap ✓, TTL preserved ✓
- [x] **No placeholders:** Full rewrites shown ✓
- [x] **Existing items migration:** Old items from SecureStore/AsyncStorage won't have `retryCount`/`nextRetryAt` — `undefined` will be falsy so `nextRetryAt > now` is false (0 > now = false) and `retryCount >= MAX_RETRIES` is false — backward compatible ✓
- [x] **Jitter formula:** `Math.random() * 5_000` — uniform 0–5 s spread across 20 units ✓
- [x] **Photo file cleanup:** Expired/exhausted photos also have their local file deleted ✓
- [x] **Does not stop on first failure:** Unlike the old code, each item is evaluated independently — one bad photo doesn't block the rest ✓
