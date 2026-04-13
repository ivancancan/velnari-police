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

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: Redis;

  constructor(config: { host: string; port: number }) {
    this.client = new Redis({
      host: config.host,
      port: config.port,
      lazyConnect: true,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
    });

    this.client.on('error', (err: Error) => {
      this.logger.error(`Redis error: ${err.message}`);
    });
  }

  async setUnitPosition(unitId: string, position: UnitPosition): Promise<void> {
    const key = `unit:${unitId}:position`;
    await this.client.set(key, JSON.stringify(position), 'EX', POSITION_TTL_SECONDS);
  }

  async getUnitPosition(unitId: string): Promise<UnitPosition | null> {
    const key = `unit:${unitId}:position`;
    const value = await this.client.get(key);
    if (!value) return null;
    return JSON.parse(value) as UnitPosition;
  }

  async clearUnitPosition(unitId: string): Promise<void> {
    const key = `unit:${unitId}:position`;
    await this.client.del(key);
  }

  /** Blacklist a JWT token ID until its original expiry */
  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    await this.client.set(`blacklist:${jti}`, '1', 'EX', ttlSeconds);
  }

  // ─── Login failure tracking (account lockout) ─────────────────────────────
  private loginFailKey(identifier: string): string {
    // normalize: lower-case email OR IP
    return `login:fail:${identifier.trim().toLowerCase()}`;
  }

  /** Returns the current failure count for an identifier (email or IP). */
  async getLoginFailCount(identifier: string): Promise<number> {
    try {
      const v = await this.client.get(this.loginFailKey(identifier));
      return v ? parseInt(v, 10) : 0;
    } catch {
      return 0;
    }
  }

  /** Increment failure counter and return the new count. TTL resets to window on each fail. */
  async incrementLoginFail(identifier: string, windowSeconds = 900): Promise<number> {
    try {
      const key = this.loginFailKey(identifier);
      const count = await this.client.incr(key);
      await this.client.expire(key, windowSeconds);
      return count;
    } catch {
      return 0;
    }
  }

  /** Reset failure counter after a successful login. */
  async resetLoginFails(identifier: string): Promise<void> {
    try {
      await this.client.del(this.loginFailKey(identifier));
    } catch { /* noop */ }
  }

  /** Check if a token ID has been blacklisted */
  async isTokenBlacklisted(jti: string): Promise<boolean> {
    try {
      const val = await this.client.get(`blacklist:${jti}`);
      return val !== null;
    } catch (err) {
      this.logger.warn(`Redis blacklist check failed, failing open: ${(err as Error).message}`);
      return false;
    }
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
    await this.client.quit();
  }
}
