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
    // Probe DB and Redis in parallel. Only DB failure is fatal for the API —
    // Redis powers rate limiting, token blacklist, and GPS caching, but each
    // of those is designed to fail-open. Losing Redis degrades security
    // posture but doesn't stop dispatch, so we report it as "degraded" with
    // 200 OK and let an external monitor alert on the degraded status.
    const [dbOk, redisOk] = await Promise.all([
      this.dataSource.query('SELECT 1').then(() => true).catch(() => false),
      this.redis.ping().catch(() => false),
    ]);

    const result = {
      status: !dbOk ? 'down' : redisOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbOk ? 'connected' : 'unreachable',
      redis: redisOk ? 'connected' : 'unreachable',
      version: process.env['GIT_SHA'] ?? 'dev',
      buildTime: process.env['BUILD_TIME'] ?? null,
    };

    if (!dbOk) {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
