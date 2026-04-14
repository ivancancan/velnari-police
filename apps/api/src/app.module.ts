import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { LoggerModule } from 'nestjs-pino';
import { join } from 'path';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { SectorsModule } from './modules/sectors/sectors.module';
import { UnitsModule } from './modules/units/units.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { UsersModule } from './modules/users/users.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { PatrolsModule } from './modules/patrols/patrols.module';
import { ChatModule } from './modules/chat/chat.module';
import { AuditModule } from './modules/audit/audit.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { CleanupModule } from './modules/cleanup/cleanup.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { IngestModule } from './modules/ingest/ingest.module';
import { SupportModule } from './modules/support/support.module';
import { HealthController } from './modules/health/health.controller';
import { AuditInterceptor } from './shared/interceptors/audit.interceptor';
import { RedisCacheService } from './shared/services/redis-cache.service';
import { SentryTypeOrmLogger } from './shared/typeorm-logger';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
        // Structured JSON in production; pretty-print in development
        transport: process.env['NODE_ENV'] !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
          : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        customProps: (_req, _res) => ({ service: 'velnari-api' }),
        serializers: {
          req(req: { method: string; url: string }) {
            return { method: req.method, url: req.url };
          },
        },
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDev = config.get('nodeEnv') === 'development';
        return {
          type: 'postgres',
          host: config.get('database.host'),
          port: config.get<number>('database.port'),
          username: config.get('database.username'),
          password: config.get('database.password'),
          database: config.get('database.database'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
          synchronize: false,
          // In dev → log everything to stdout. In prod → use the Sentry logger
          // which only forwards errors + slow queries, keeping Sentry signal high.
          logging: isDev ? true : ['error', 'warn', 'migration'],
          logger: isDev ? 'advanced-console' : new SentryTypeOrmLogger(['error', 'warn']),
          // Queries slower than this are reported via logQuerySlow (the custom
          // logger above batches to Sentry breadcrumbs + events).
          maxQueryExecutionTime: 500,
          connectTimeoutMS: 5_000,
          extra: {
            max: 20,
            min: 2,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 5_000,
          },
        };
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    AuthModule,
    SectorsModule,
    UnitsModule,
    IncidentsModule,
    DispatchModule,
    RealtimeModule,
    UsersModule,
    AttachmentsModule,
    PatrolsModule,
    ChatModule,
    AuditModule,
    ReportsModule,
    ShiftsModule,
    CleanupModule,
    TenantsModule,
    IngestModule,
    SupportModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
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
export class AppModule {}
