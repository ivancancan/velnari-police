import { Injectable, CanActivate } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, ROLE_DEFAULT_PERMISSIONS } from '@velnari/shared-types';
import { ROLES_KEY, PERMISSION_KEY } from '../decorators/roles.decorator';

interface RequestWithUser {
  user: { role: UserRole; customPermissions?: string[] };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<RequestWithUser>();

    // Admin bypasses everything
    if (user.role === UserRole.ADMIN) return true;

    // Check role-based access
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(user.role)) return false;
    }

    // Check fine-grained permission (if decorator present)
    const requiredPermission = this.reflector.get<string | undefined>(
      PERMISSION_KEY,
      context.getHandler(),
    );
    if (requiredPermission) {
      const defaultPerms = ROLE_DEFAULT_PERMISSIONS[user.role] ?? [];
      const allPerms = [...defaultPerms, ...(user.customPermissions ?? [])];
      return allPerms.includes(requiredPermission);
    }

    return true;
  }
}
