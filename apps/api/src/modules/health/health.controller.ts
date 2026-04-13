import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { RedisCacheService } from '../../shared/services/redis-cache.service';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisCacheService,
  ) {}

  @Get()
  async check() {
    // Probe DB and Redis in parallel so slow dependencies don't serialize the check.
    const [dbOk, redisOk] = await Promise.all([
      this.dataSource.query('SELECT 1').then(() => true).catch(() => false),
      // Lightweight ping — incrementing a disposable key with a 1s TTL
      // verifies Redis is reachable + accepts writes (not just reads).
      this.redis.ping().catch(() => false),
    ]);

    const ok = dbOk && redisOk;
    const result = {
      status: ok ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbOk ? 'connected' : 'unreachable',
      redis: redisOk ? 'connected' : 'unreachable',
      version: process.env['GIT_SHA'] ?? 'dev',
      buildTime: process.env['BUILD_TIME'] ?? null,
    };

    if (!ok) {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
