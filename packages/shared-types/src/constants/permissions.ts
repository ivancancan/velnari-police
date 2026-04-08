export const PERMISSIONS = {
  // Incidentes
  INCIDENTS_CREATE:   'incidents:create',
  INCIDENTS_ASSIGN:   'incidents:assign',
  INCIDENTS_CLOSE:    'incidents:close',
  INCIDENTS_VIEW_ALL: 'incidents:view_all',

  // Unidades
  UNITS_MANAGE:       'units:manage',
  UNITS_VIEW_HISTORY: 'units:view_history',

  // Sectores
  SECTORS_MANAGE:     'sectors:manage',

  // Usuarios (solo admin)
  USERS_MANAGE:       'users:manage',

  // Reportes
  REPORTS_VIEW:       'reports:view',
  REPORTS_EXPORT:     'reports:export',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/** Permisos por defecto de cada rol */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  admin: Object.values(PERMISSIONS) as Permission[],
  commander: [
    PERMISSIONS.INCIDENTS_CREATE, PERMISSIONS.INCIDENTS_ASSIGN,
    PERMISSIONS.INCIDENTS_CLOSE, PERMISSIONS.INCIDENTS_VIEW_ALL,
    PERMISSIONS.UNITS_MANAGE, PERMISSIONS.UNITS_VIEW_HISTORY,
    PERMISSIONS.SECTORS_MANAGE, PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_EXPORT,
  ],
  supervisor: [
    PERMISSIONS.INCIDENTS_CREATE, PERMISSIONS.INCIDENTS_ASSIGN,
    PERMISSIONS.INCIDENTS_CLOSE, PERMISSIONS.INCIDENTS_VIEW_ALL,
    PERMISSIONS.UNITS_VIEW_HISTORY, PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_EXPORT,
  ],
  operator: [
    PERMISSIONS.INCIDENTS_CREATE, PERMISSIONS.INCIDENTS_ASSIGN,
    PERMISSIONS.INCIDENTS_CLOSE, PERMISSIONS.INCIDENTS_VIEW_ALL,
  ],
  field_unit: [],
};
