// apps/web/src/components/admin/UserTable.tsx
import type { User } from '@/lib/types';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  commander: 'Comandante',
  supervisor: 'Supervisor',
  operator: 'Operador',
  field_unit: 'Unidad',
};

interface UserTableProps {
  users: User[];
  onEdit: (user: User) => void;
  onDeactivate: (user: User) => void;
}

export default function UserTable({ users, onEdit, onDeactivate }: UserTableProps) {
  if (users.length === 0) {
    return <p className="text-slate-gray text-sm py-8 text-center">Sin usuarios registrados.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-slate-gray uppercase border-b border-slate-700">
          <tr>
            <th className="py-3 px-4">Nombre</th>
            <th className="py-3 px-4">Email</th>
            <th className="py-3 px-4">Rol</th>
            <th className="py-3 px-4">Placa</th>
            <th className="py-3 px-4">Estado</th>
            <th className="py-3 px-4">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-slate-800 hover:bg-slate-800/40">
              <td className="py-3 px-4 text-signal-white">{u.name}</td>
              <td className="py-3 px-4 text-slate-gray">{u.email}</td>
              <td className="py-3 px-4">
                <span className="px-2 py-0.5 rounded text-xs bg-tactical-blue/20 text-tactical-blue">
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
              </td>
              <td className="py-3 px-4 text-slate-gray">{u.badgeNumber ?? '—'}</td>
              <td className="py-3 px-4">
                {u.isActive ? (
                  <span className="text-green-400 text-xs">Activo</span>
                ) : (
                  <span className="text-red-400 text-xs">Inactivo</span>
                )}
              </td>
              <td className="py-3 px-4 flex gap-2">
                <button
                  onClick={() => onEdit(u)}
                  className="text-xs text-tactical-blue hover:underline"
                >
                  Editar
                </button>
                {u.isActive && (
                  <button
                    onClick={() => onDeactivate(u)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Desactivar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
