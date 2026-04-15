import { Injectable, CanActivate, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, ROLE_DEFAULT_PERMISSIONS } from '@velnari/shared-types';
import { ROLES_KEY, PERMISSION_KEY, PUBLIC_KEY } from '../decorators/roles.decorator';

interface RequestWithUser {
  user: { role: UserRole; customPermissions?: string[] };
  method: string;
  url: string;
}

// HTTP verbs that require explicit @Roles (fail-closed). GETs keep the
// permissive default so the many read endpoints don't all need decorators
// — they're still JWT-gated, just not role-gated.
const WRITE_VERBS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const user = req.user;

    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    // Admin bypasses everything
    if (user?.role === UserRole.ADMIN) return true;

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredPermission = this.reflector.get<string | undefined>(
      PERMISSION_KEY,
      context.getHandler(),
    );

    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(user.role)) return false;
    } else if (!requiredPermission && WRITE_VERBS.has(req.method)) {
      // Fail closed: any write endpoint MUST declare @Roles or @Permission,
      // otherwise we refuse. Prevents silent exposure of unprotected writes.
      this.logger.error(
        `RolesGuard blocked ${req.method} ${req.url} — no @Roles/@Permission declared. ` +
        `Add a role decorator or mark the route with @Public().`,
      );
      return false;
    }

    if (requiredPermission) {
      const defaultPerms = ROLE_DEFAULT_PERMISSIONS[user.role] ?? [];
      const allPerms = [...defaultPerms, ...(user.customPermissions ?? [])];
      return allPerms.includes(requiredPermission);
    }

    return true;
  }
}
