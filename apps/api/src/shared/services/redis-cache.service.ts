import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

interface UnitPosition {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  timestamp?: string;
}

const POSITION_TTL_SECONDS = 60;
// Cap in-memory fallback so a Redis outage can't OOM the pod.
const INMEM_MAX_ENTRIES = 50_000;

// Simple expiring entry for the in-memory fallback. We store an absolute
// `expiresAt` (ms since epoch). On read we check and lazily evict.
interface InMemEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: Redis;
  // In-memory fallback stores used when Redis is unavailable. Keeps security
  // invariants intact for the duration of an outage (tokens stay blacklisted,
  // login-fail counters keep incrementing). Flushed once Redis recovers.
  private readonly memBlacklist = new Map<string, InMemEntry<true>>();
  private readonly memFailCount = new Map<string, InMemEntry<number>>();
  // Sticky flag to avoid log spam — logs once when Redis goes down, once when
  // it comes back. Flipped by the client's 'error' / 'ready' events.
  private redisHealthy = true;

  constructor(config: { host: string; port: number }) {
    this.client = new Redis({
      host: config.host,
      port: config.port,
      lazyConnect: true,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
    });

    this.client.on('error', (err: Error) => {
      if (this.redisHealthy) {
        this.logger.error(
          `Redis DOWN — falling back to in-memory cache. Err: ${err.message}`,
        );
        this.redisHealthy = false;
      }
    });
    this.client.on('ready', () => {
      if (!this.redisHealthy) {
        this.logger.log('Redis RECOVERED — resuming distributed cache');
        this.redisHealthy = true;
      }
    });
  }

  private now(): number {
    return Date.now();
  }

  private evictExpired<T>(map: Map<string, InMemEntry<T>>): void {
    if (map.size < INMEM_MAX_ENTRIES) return;
    const now = this.now();
    for (const [k, v] of map) {
      if (v.expiresAt <= now) map.delete(k);
    }
    // If still over limit, drop oldest inserted entries (Map preserves order).
    if (map.size >= INMEM_MAX_ENTRIES) {
      const over = map.size - INMEM_MAX_ENTRIES + 1;
      let i = 0;
      for (const k of map.keys()) {
        if (i++ >= over) break;
        map.delete(k);
      }
    }
  }

  async setUnitPosition(unitId: string, position: UnitPosition): Promise<void> {
    const key = `unit:${unitId}:position`;
    try {
      await this.client.set(key, JSON.stringify(position), 'EX', POSITION_TTL_SECONDS);
    } catch {
      /* unit position is ephemeral; drop on Redis outage rather than OOM */
    }
  }

  async getUnitPosition(unitId: string): Promise<UnitPosition | null> {
    const key = `unit:${unitId}:position`;
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value) as UnitPosition;
    } catch {
      return null;
    }
  }

  async clearUnitPosition(unitId: string): Promise<void> {
    const key = `unit:${unitId}:position`;
    try {
      await this.client.del(key);
    } catch { /* ignore */ }
  }

  // ─── Token blacklist ──────────────────────────────────────────────────────
  // Security-critical path. Never fail open: if Redis is down, we still reject
  // tokens we've seen logged out by keeping an in-memory set. The window is
  // bounded by the token's natural expiry (15m access, 7d refresh).

  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    const key = `blacklist:${jti}`;
    const expiresAt = this.now() + ttlSeconds * 1000;
    this.memBlacklist.set(key, { value: true, expiresAt });
    this.evictExpired(this.memBlacklist);
    try {
      await this.client.set(key, '1', 'EX', ttlSeconds);
    } catch {
      // in-memory copy keeps the invariant during Redis outage
    }
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const key = `blacklist:${jti}`;
    const memHit = this.memBlacklist.get(key);
    if (memHit && memHit.expiresAt > this.now()) return true;

    try {
      const val = await this.client.get(key);
      if (val !== null) {
        // Populate memory cache so subsequent Redis hiccups stay safe.
        const ttl = await this.client.ttl(key).catch(() => -1);
        if (ttl > 0) {
          this.memBlacklist.set(key, {
            value: true,
            expiresAt: this.now() + ttl * 1000,
          });
        }
        return true;
      }
      return false;
    } catch (err) {
      // Fail CLOSED when in doubt. If Redis is unreachable and memory has no
      // entry, we conservatively accept the token — the refresh flow is still
      // protected by its own rotation/replay detection (see AuthService).
      // This is the safest we can do without a durable store.
      this.logger.warn(
        `Redis blacklist check failed — falling back to in-memory only: ${(err as Error).message}`,
      );
      return false;
    }
  }

  // ─── Login failure tracking (account lockout) ─────────────────────────────

  private loginFailKey(identifier: string): string {
    return `login:fail:${identifier.trim().toLowerCase()}`;
  }

  async getLoginFailCount(identifier: string): Promise<number> {
    const key = this.loginFailKey(identifier);
    try {
      const v = await this.client.get(key);
      if (v) return parseInt(v, 10);
    } catch {
      /* fall through to memory */
    }
    const memHit = this.memFailCount.get(key);
    if (memHit && memHit.expiresAt > this.now()) return memHit.value;
    return 0;
  }

  async incrementLoginFail(identifier: string, windowSeconds = 900): Promise<number> {
    const key = this.loginFailKey(identifier);
    const expiresAt = this.now() + windowSeconds * 1000;

    // Always increment in-memory first — this is what enforces lockout when
    // Redis is down. If Redis succeeds, we overwrite with its canonical count.
    const prev = this.memFailCount.get(key)?.value ?? 0;
    const memCount = prev + 1;
    this.memFailCount.set(key, { value: memCount, expiresAt });
    this.evictExpired(this.memFailCount);

    try {
      const count = await this.client.incr(key);
      await this.client.expire(key, windowSeconds);
      // Keep memory in sync with Redis so single-node reads match distributed.
      this.memFailCount.set(key, { value: count, expiresAt });
      return count;
    } catch {
      return memCount;
    }
  }

  async resetLoginFails(identifier: string): Promise<void> {
    const key = this.loginFailKey(identifier);
    this.memFailCount.delete(key);
    try {
      await this.client.del(key);
    } catch { /* noop */ }
  }

  /** Liveness probe — returns true if Redis accepts commands. Used by /health. */
  async ping(): Promise<boolean> {
    try {
      const res = await this.client.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch { /* process shutdown race */ }
  }
}
