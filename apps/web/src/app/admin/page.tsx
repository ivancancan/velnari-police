'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { usersApi } from '@/lib/api';
import UserTable from '@/components/admin/UserTable';
import UserFormModal from '@/components/admin/UserFormModal';
import type { User } from '@/lib/types';

const TABS = [
  { label: 'Usuarios', href: '/admin' },
  { label: 'Sectores / Geocercas', href: '/admin/sectors' },
  { label: 'Reportes por Unidad', href: '/admin/reports' },
];

export default function AdminPage() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
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
    <div className="min-h-screen bg-midnight-command text-signal-white">
      {/* Header */}
      <header className="px-6 pt-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold tracking-wide">Administración</h1>
            <p className="text-slate-400 text-xs mt-0.5">Gestiona usuarios, sectores y reportes</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/command" className="text-xs text-slate-400 hover:text-white transition-colors">
              ← Centro de Mando
            </Link>
            {pathname === '/admin' && (
              <button
                onClick={() => setShowCreate(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-2 rounded-lg font-medium transition-colors"
              >
                + Nuevo usuario
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex gap-1">
          {TABS.map(tab => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                pathname === tab.href
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-slate-600'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="p-6">
        {loading ? (
          <p className="text-slate-400 text-sm">Cargando usuarios…</p>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <UserTable
              users={users}
              onEdit={u => setEditUser(u)}
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
