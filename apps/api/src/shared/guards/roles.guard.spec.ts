import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { UserRole } from '@velnari/shared-types';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const mockContext = (userRole: UserRole, requiredRoles?: UserRole[]) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: userRole } }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  };

  it('permite acceso si no hay roles requeridos', () => {
    const ctx = mockContext(UserRole.FIELD_UNIT, undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('permite acceso si el rol del usuario coincide', () => {
    const ctx = mockContext(UserRole.OPERATOR, [UserRole.OPERATOR, UserRole.SUPERVISOR]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('deniega acceso si el rol no coincide', () => {
    const ctx = mockContext(UserRole.FIELD_UNIT, [UserRole.OPERATOR, UserRole.SUPERVISOR]);
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('admin siempre tiene acceso independientemente de los roles requeridos', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.OPERATOR]);
    const adminCtx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: UserRole.ADMIN } }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(adminCtx)).toBe(true);
  });
});
