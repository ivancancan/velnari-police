import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@velnari/shared-types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSION_KEY = 'required_permission';
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);

// Explicitly mark a route as intentionally ungated (e.g. auth/login, health).
// Required because RolesGuard fails closed on writes without @Roles.
export const PUBLIC_KEY = 'route_is_public';
export const Public = () => SetMetadata(PUBLIC_KEY, true);
