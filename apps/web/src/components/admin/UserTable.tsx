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
    return <p className="text-gray-400 text-sm py-8 text-center">Sin usuarios registrados.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200 bg-gray-50/80">
          <tr>
            <th className="py-3 px-5 font-medium">Nombre</th>
            <th className="py-3 px-5 font-medium">Email</th>
            <th className="py-3 px-5 font-medium">Rol</th>
            <th className="py-3 px-5 font-medium">Placa</th>
            <th className="py-3 px-5 font-medium">Estado</th>
            <th className="py-3 px-5 font-medium text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((u, idx) => (
            <tr key={u.id} className={`transition-all duration-150 border-l-2 border-transparent hover:border-l-2 hover:border-blue-500 hover:bg-blue-50/40 ${idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}`}>
              <td className="py-3 px-5 text-gray-900 font-medium">{u.name}</td>
              <td className="py-3 px-5 text-gray-500">{u.email}</td>
              <td className="py-3 px-5">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
              </td>
              <td className="py-3 px-5 text-gray-500">{u.badgeNumber ?? '—'}</td>
              <td className="py-3 px-5">
                {u.isActive ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
                    <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]" />
                    Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-gray-300" />
                    Inactivo
                  </span>
                )}
              </td>
              <td className="py-3 px-5 text-right">
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => onEdit(u)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    Editar
                  </button>
                  {u.isActive && (
                    <button
                      onClick={() => onDeactivate(u)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                    >
                      Desactivar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
