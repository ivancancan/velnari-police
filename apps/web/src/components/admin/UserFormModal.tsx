// apps/web/src/components/admin/UserFormModal.tsx
'use client';

import { useState } from 'react';
import type { User } from '@/lib/types';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'commander', label: 'Comandante' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'operator', label: 'Operador' },
  { value: 'field_unit', label: 'Unidad de Campo' },
];

interface UserFormModalProps {
  user?: User | null;
  onSubmit: (data: {
    name: string;
    email: string;
    password: string;
    role: string;
    badgeNumber: string;
  }) => Promise<void>;
  onClose: () => void;
}

export default function UserFormModal({ user, onSubmit, onClose }: UserFormModalProps) {
  const isEdit = !!user;
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user?.role ?? 'operator');
  const [badgeNumber, setBadgeNumber] = useState(user?.badgeNumber ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEdit && password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmit({ name, email, password, role, badgeNumber });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 className="text-signal-white font-semibold text-lg mb-4">
          {isEdit ? 'Editar usuario' : 'Nuevo usuario'}
        </h2>

        {error && (
          <p className="text-red-400 text-xs mb-3 bg-red-950 border border-red-800 rounded px-3 py-2">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-slate-gray text-xs block mb-1">Nombre completo</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white text-sm focus:outline-none focus:border-tactical-blue"
            />
          </div>

          {!isEdit && (
            <div>
              <label className="text-slate-gray text-xs block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white text-sm focus:outline-none focus:border-tactical-blue"
              />
            </div>
          )}

          <div>
            <label className="text-slate-gray text-xs block mb-1">
              {isEdit ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!isEdit}
              minLength={8}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white text-sm focus:outline-none focus:border-tactical-blue"
            />
          </div>

          <div>
            <label className="text-slate-gray text-xs block mb-1">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white text-sm focus:outline-none focus:border-tactical-blue"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-gray text-xs block mb-1">Número de placa (opcional)</label>
            <input
              value={badgeNumber}
              onChange={(e) => setBadgeNumber(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white text-sm focus:outline-none focus:border-tactical-blue"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-tactical-blue hover:bg-blue-600 disabled:opacity-50 text-white rounded py-2 text-sm font-medium"
            >
              {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-signal-white rounded py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
