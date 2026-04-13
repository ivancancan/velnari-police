import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { AuditLogEntity } from '../../entities/audit-log.entity';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Fields redacted before persisting to audit log — never store credentials or tokens.
const REDACTED_FIELDS = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'token',
  'accessToken',
  'refreshToken',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'secret',
  'apiKey',
  'api_key',
]);

const MAX_BODY_BYTES = 4_000; // cap audit payload size

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACTED_FIELDS.has(k) || REDACTED_FIELDS.has(k.toLowerCase())) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

interface RequestWithUser {
  method: string;
  url: string;
  ip: string;
  body?: unknown;
  user?: { sub: string };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (!WRITE_METHODS.has(request.method)) {
      return next.handle();
    }

    const handlerName = context.getHandler().name;
    const controllerName = context.getClass().name;
    const actorId = request.user?.sub;
    const redactedBody = redact(request.body);
    let serializedBody: string | null = null;
    try {
      const s = JSON.stringify(redactedBody);
      serializedBody = s.length > MAX_BODY_BYTES ? s.slice(0, MAX_BODY_BYTES) + '…' : s;
    } catch {
      serializedBody = null;
    }

    return next.handle().pipe(
      tap({
        next: (responseBody: unknown) => {
          if (!actorId) return;

          const entityId =
            typeof responseBody === 'object' &&
            responseBody !== null &&
            'id' in responseBody
              ? String((responseBody as Record<string, unknown>)['id'])
              : 'unknown';

          const auditLog = this.dataSource.getRepository(AuditLogEntity).create({
            entityType: controllerName.replace('Controller', '').toLowerCase(),
            entityId,
            action: handlerName,
            actorId,
            ipAddress: request.ip,
            changes: serializedBody
              ? { body: serializedBody, method: request.method, path: request.url }
              : { method: request.method, path: request.url },
          });

          this.dataSource
            .getRepository(AuditLogEntity)
            .save(auditLog)
            .catch((err: Error) =>
              this.logger.error(`Failed to save audit log: ${err.message}`),
            );
        },
      }),
    );
  }
}
