import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@velnari/shared-types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSION_KEY = 'required_permission';
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);
