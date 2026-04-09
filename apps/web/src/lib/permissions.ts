// Role-based UI permissions — mirrors backend @Roles decorators
export type Role = 'admin' | 'commander' | 'supervisor' | 'operator' | 'field_unit';

const can = (role: Role | undefined, allowed: Role[]): boolean =>
  !!role && allowed.includes(role);

export const permissions = {
  createIncident:  (role?: Role) => can(role, ['admin', 'operator', 'supervisor']),
  assignUnit:      (role?: Role) => can(role, ['admin', 'operator', 'supervisor']),
  closeIncident:   (role?: Role) => can(role, ['admin', 'operator', 'supervisor']),
  createPatrol:    (role?: Role) => can(role, ['admin', 'supervisor', 'commander', 'operator']),
  cancelPatrol:    (role?: Role) => can(role, ['admin', 'supervisor', 'commander', 'operator']),
  manageUnits:     (role?: Role) => can(role, ['admin', 'commander', 'supervisor']),
  changeUnitStatus:(role?: Role) => can(role, ['admin', 'operator', 'supervisor', 'field_unit']),
  manageSectors:   (role?: Role) => can(role, ['admin']),
  manageUsers:     (role?: Role) => can(role, ['admin']),
};
