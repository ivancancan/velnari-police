import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { initSentry } from './shared/sentry';
import { validateEnv } from './config/configuration';

// Crash immediately with a clear error list if required prod vars are missing
validateEnv();
initSentry();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // Enable graceful shutdown hooks (calls onModuleDestroy/onApplicationShutdown on SIGTERM/SIGINT).
  // Railway/containers send SIGTERM on deploy; without this, in-flight requests get killed.
  app.enableShutdownHooks();

  // Explicit body-size caps — prevents memory-exhaustion DoS via huge JSON payloads.
  // File uploads use Multer which has its own per-file cap (10MB), see attachments module.
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  app.use(helmet({
    // Allow swagger UI to load its assets
    contentSecurityPolicy: process.env['NODE_ENV'] === 'production' ? undefined : false,
  }));
  const configService = app.get(ConfigService);
  app.enableCors({
    origin: configService.get<string[]>('allowedOrigins') ?? ['http://localhost:3000'],
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Swagger — only in non-production or when explicitly enabled
  if (process.env['NODE_ENV'] !== 'production' || process.env['SWAGGER_ENABLED'] === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Velnari API')
      .setDescription('API para el sistema operativo de seguridad municipal Velnari')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addTag('auth', 'Autenticación y sesión')
      .addTag('units', 'Unidades patrulla')
      .addTag('incidents', 'Incidentes')
      .addTag('dispatch', 'Despacho')
      .addTag('sectors', 'Sectores')
      .addTag('users', 'Usuarios')
      .addTag('patrols', 'Patrullajes')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);
  const logger = app.get(Logger);
  logger.log(`API running on http://localhost:${port}/api`);
  if (process.env['NODE_ENV'] !== 'production') {
    logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }

  // Explicit signal handlers — Railway/Docker send SIGTERM; Nest's shutdown hooks
  // will drain connections and close DB pools before the process exits.
  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`Received ${signal} — shutting down gracefully...`);
    try {
      await app.close();
      logger.log('HTTP server closed. Exiting.');
      process.exit(0);
    } catch (err) {
      logger.error(`Shutdown failed: ${(err as Error).message}`);
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void bootstrap();
