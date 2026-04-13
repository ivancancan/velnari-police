'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { usersApi } from '@/lib/api';
import { reportError } from '@/lib/report-error';
import UserTable from '@/components/admin/UserTable';
import UserFormModal from '@/components/admin/UserFormModal';
import type { User } from '@/lib/types';
import { UserPlus } from 'lucide-react';

export default function AdminUsersPage() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');

  function loadUsers() {
    setLoading(true);
    usersApi.getAll()
      .then(res => setUsers(res.data))
      .catch((err) => reportError(err, { tag: 'admin.loadUsers' }))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleCreate(data: {
    name: string; email: string; password: string; role: string;
    badgeNumber: string; sectorId: string; shift: string; customPermissions: string[];
  }) {
    await usersApi.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
      badgeNumber: data.badgeNumber || undefined,
      sectorId: data.sectorId || undefined,
    });
    loadUsers();
  }

  async function handleEdit(data: {
    name: string; email: string; password: string; role: string;
    badgeNumber: string; sectorId: string; shift: string; customPermissions: string[];
  }) {
    if (!editUser) return;
    await usersApi.update(editUser.id, {
      name: data.name,
      role: data.role,
      badgeNumber: data.badgeNumber || undefined,
      sectorId: data.sectorId || undefined,
      shift: data.shift || undefined,
      customPermissions: data.customPermissions,
      password: data.password || undefined,
    });
    loadUsers();
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    if (!newPassword || newPassword.length < 8) {
      setResetError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    try {
      await usersApi.resetPassword(resetTarget.id, newPassword);
      setResetTarget(null);
      setNewPassword('');
      setResetError('');
      if (typeof window !== 'undefined') {
        window.alert('Contraseña actualizada. Comunícala al usuario por un canal seguro.');
      }
    } catch (err) {
      reportError(err, { tag: 'admin.resetPassword' });
      setResetError('No se pudo actualizar la contraseña. Intenta de nuevo.');
    }
  }

  async function handleDeactivate(u: User) {
    if (!confirm(`¿Desactivar a ${u.name}?`)) return;
    await usersApi.update(u.id, { isActive: false });
    loadUsers();
  }

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {users.length} usuario{users.length !== 1 ? 's' : ''} activo{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <UserPlus size={15} />
          Nuevo usuario
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Cargando usuarios…</div>
        ) : (
          <UserTable
            users={users}
            onEdit={u => setEditUser(u)}
            onDeactivate={handleDeactivate}
            onResetPassword={u => { setResetTarget(u); setNewPassword(''); setResetError(''); }}
          />
        )}
      </div>

      {showCreate && (
        <UserFormModal
          onSubmit={async (data) => { await handleCreate(data); setShowCreate(false); }}
          onClose={() => setShowCreate(false)}
        />
      )}
      {editUser && (
        <UserFormModal
          user={editUser}
          onSubmit={async (data) => { await handleEdit(data); setEditUser(null); }}
          onClose={() => setEditUser(null)}
        />
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Cambiar contraseña</h2>
            <p className="text-sm text-gray-500 mb-4">
              Establecer nueva contraseña para <span className="font-medium text-gray-700">{resetTarget.name}</span>
            </p>
            <input
              type="password"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setResetError(''); }}
              placeholder="Nueva contraseña (mín. 8 caracteres)"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            />
            {resetError && (
              <p className="text-xs text-red-600 mb-2">{resetError}</p>
            )}
            <div className="flex gap-2 justify-end mt-3">
              <button
                onClick={() => { setResetTarget(null); setNewPassword(''); setResetError(''); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleResetPassword}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
