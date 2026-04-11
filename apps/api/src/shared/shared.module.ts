import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from './services/redis-cache.service';

@Module({
  providers: [
    {
      provide: RedisCacheService,
      useFactory: (config: ConfigService) =>
        new RedisCacheService({
          host: config.get<string>('redis.host') ?? 'localhost',
          port: config.get<number>('redis.port') ?? 6379,
        }),
      inject: [ConfigService],
    },
  ],
  exports: [RedisCacheService],
})
export class SharedModule {}
