import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
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
import { HealthController } from './modules/health/health.controller';
import { AuditInterceptor } from './shared/interceptors/audit.interceptor';
import { RedisCacheService } from './shared/services/redis-cache.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get<number>('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.database'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: false,
        logging: config.get('nodeEnv') === 'development',
      }),
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
