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

interface RequestWithUser {
  method: string;
  url: string;
  ip: string;
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
