// apps/web/src/app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { usersApi } from '@/lib/api';
import UserTable from '@/components/admin/UserTable';
import UserFormModal from '@/components/admin/UserFormModal';
import type { User } from '@/lib/types';
import Link from 'next/link';

export default function AdminPage() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return; }
    if (user?.role !== 'admin') { router.push('/command'); return; }
  }, [isAuthenticated, user, router]);

  function loadUsers() {
    setLoading(true);
    usersApi.getAll()
      .then((res) => setUsers(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleCreate(data: {
    name: string; email: string; password: string; role: string; badgeNumber: string;
  }) {
    await usersApi.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
      badgeNumber: data.badgeNumber || undefined,
    });
    loadUsers();
  }

  async function handleEdit(data: {
    name: string; email: string; password: string; role: string; badgeNumber: string;
  }) {
    if (!editUser) return;
    await usersApi.update(editUser.id, {
      name: data.name,
      role: data.role,
      badgeNumber: data.badgeNumber || undefined,
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
    <div className="min-h-screen bg-midnight-command text-signal-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <h1 className="text-lg font-semibold tracking-wide">Gestión de Usuarios</h1>
        <div className="flex items-center gap-4">
          <Link href="/command" className="text-xs text-slate-gray hover:text-signal-white">
            ← Centro de Mando
          </Link>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-tactical-blue hover:bg-blue-600 text-white text-xs px-3 py-2 rounded font-medium"
          >
            + Nuevo usuario
          </button>
        </div>
      </header>

      <main className="p-6">
        {loading ? (
          <p className="text-slate-gray text-sm">Cargando usuarios...</p>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-lg">
            <UserTable
              users={users}
              onEdit={(u) => setEditUser(u)}
              onDeactivate={handleDeactivate}
            />
          </div>
        )}
      </main>

      {showCreate && (
        <UserFormModal
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editUser && (
        <UserFormModal
          user={editUser}
          onSubmit={handleEdit}
          onClose={() => setEditUser(null)}
        />
      )}
    </div>
  );
}
