import 'reflect-metadata';
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
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
  });

  const mockContext = (
    userRole: UserRole,
    requiredRoles?: UserRole[],
    method: string = 'GET',
    isPublic = false,
  ) => {
    // getAllAndOverride is called for both PUBLIC_KEY and ROLES_KEY. We
    // mock it twice — once for the public flag, once for the roles array.
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key) => {
        if (key === 'route_is_public') return isPublic;
        if (key === 'roles') return requiredRoles;
        return undefined;
      });
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: userRole }, method, url: '/test' }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  };

  it('permite GET sin @Roles (lectura sigue siendo abierta a usuarios JWT)', () => {
    const ctx = mockContext(UserRole.FIELD_UNIT, undefined, 'GET');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('BLOQUEA POST sin @Roles (fail-closed para escrituras)', () => {
    const ctx = mockContext(UserRole.FIELD_UNIT, undefined, 'POST');
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('BLOQUEA DELETE sin @Roles', () => {
    const ctx = mockContext(UserRole.OPERATOR, undefined, 'DELETE');
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('permite POST si está marcado como @Public()', () => {
    const ctx = mockContext(UserRole.FIELD_UNIT, undefined, 'POST', true);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('permite acceso si el rol del usuario coincide', () => {
    const ctx = mockContext(
      UserRole.OPERATOR,
      [UserRole.OPERATOR, UserRole.SUPERVISOR],
      'POST',
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('deniega acceso si el rol no coincide', () => {
    const ctx = mockContext(
      UserRole.FIELD_UNIT,
      [UserRole.OPERATOR, UserRole.SUPERVISOR],
      'POST',
    );
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('admin siempre tiene acceso (incluso sin @Roles en POST)', () => {
    const ctx = mockContext(UserRole.ADMIN, undefined, 'POST');
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
