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

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
