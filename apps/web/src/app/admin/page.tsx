'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { usersApi } from '@/lib/api';
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

  function loadUsers() {
    setLoading(true);
    usersApi.getAll()
      .then(res => setUsers(res.data))
      .catch(console.error)
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
    </div>
  );
}
