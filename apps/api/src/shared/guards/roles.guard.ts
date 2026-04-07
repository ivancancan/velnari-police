import { Injectable, CanActivate } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@velnari/shared-types';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface RequestWithUser {
  user: { role: UserRole };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();

    if (user.role === UserRole.ADMIN) {
      return true;
    }

    return requiredRoles.includes(user.role);
  }
}
