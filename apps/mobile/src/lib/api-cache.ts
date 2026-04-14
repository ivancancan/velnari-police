// apps/mobile/src/lib/api-cache.ts
//
// Lightweight in-memory TTL cache for hot read endpoints (units, incidents).
// Officers frequently switch tabs; without this, every focus event fires a
// duplicate network request against the same stale data.
//
// Default TTL: 60s — fresh enough for field ops, kills ~80% of redundant hits.
// Call invalidate() after any write (incident created, status changed) so the
// next read reflects the change immediately.

const store = new Map<string, { data: unknown; ts: number }>();

const DEFAULT_TTL_MS = 60_000;

/**
 * Wraps a fetcher with TTL caching. Returns cached data if it's younger than
 * ttlMs, otherwise calls fetcher, caches the result, and returns it.
 *
 * The fetcher is expected to return { data: T } (Axios-style response shape).
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<{ data: T }>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<{ data: T }> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.ts < ttlMs) {
    return { data: hit.data as T };
  }
  const res = await fetcher();
  store.set(key, { data: res.data, ts: Date.now() });
  return res;
}

/**
 * Invalidate a specific key (or the whole cache if no key given).
 * Call after writes so the next focus event fetches fresh data.
 */
export function invalidateCache(key?: string): void {
  if (key) {
    store.delete(key);
  } else {
    store.clear();
  }
}

export const CACHE_KEYS = {
  units: 'units',
  incidents: 'incidents',
} as const;
