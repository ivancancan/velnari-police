'use client';
import { ROLE_DEFAULT_PERMISSIONS } from '@velnari/shared-types';

const PERMISSION_LABELS: Record<string, string> = {
  'incidents:create':   'Crear incidentes',
  'incidents:assign':   'Asignar incidentes a unidades',
  'incidents:close':    'Cerrar incidentes',
  'incidents:view_all': 'Ver todos los incidentes',
  'units:manage':       'Gestionar unidades',
  'units:view_history': 'Ver historial GPS de unidades',
  'sectors:manage':     'Gestionar sectores y geocercas',
  'users:manage':       'Gestionar usuarios',
  'reports:view':       'Ver reportes',
  'reports:export':     'Exportar reportes (CSV/PDF)',
};

const PERMISSION_GROUPS = [
  {
    label: 'Incidentes',
    perms: ['incidents:create', 'incidents:assign', 'incidents:close', 'incidents:view_all'],
  },
  {
    label: 'Unidades',
    perms: ['units:manage', 'units:view_history'],
  },
  {
    label: 'Sectores y Administración',
    perms: ['sectors:manage', 'users:manage'],
  },
  {
    label: 'Reportes',
    perms: ['reports:view', 'reports:export'],
  },
];

interface Props {
  role: string;
  customPermissions: string[];
  onChange: (perms: string[]) => void;
}

export default function PermissionsEditor({ role, customPermissions, onChange }: Props) {
  const defaults = new Set(ROLE_DEFAULT_PERMISSIONS[role] ?? []);
  const extras = new Set(customPermissions);

  const togglePermission = (perm: string) => {
    if (defaults.has(perm)) return; // permisos del rol base son inmutables
    const next = new Set(extras);
    if (next.has(perm)) {
      next.delete(perm);
    } else {
      next.add(perm);
    }
    onChange([...next]);
  };

  const isActive = (perm: string) => defaults.has(perm) || extras.has(perm);

  return (
    <div className="space-y-5">
      <p className="text-slate-400 text-xs">
        Los permisos marcados como <span className="text-slate-300">por rol</span> vienen del rol asignado y no pueden quitarse aquí.
        Puedes agregar permisos adicionales individualmente.
      </p>
      {PERMISSION_GROUPS.map(group => (
        <div key={group.label}>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-2">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.perms.map(perm => {
              const active = isActive(perm);
              const isDefault = defaults.has(perm);
              return (
                <label
                  key={perm}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isDefault
                      ? 'cursor-default opacity-60'
                      : 'cursor-pointer hover:bg-slate-700/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    disabled={isDefault}
                    onChange={() => togglePermission(perm)}
                    className="w-4 h-4 accent-blue-500 flex-shrink-0"
                  />
                  <span className="text-white text-sm flex-1">
                    {PERMISSION_LABELS[perm] ?? perm}
                  </span>
                  {isDefault && (
                    <span className="text-xs text-slate-500 flex-shrink-0">por rol</span>
                  )}
                  {!isDefault && extras.has(perm) && (
                    <span className="text-xs text-blue-400 flex-shrink-0">extra</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
