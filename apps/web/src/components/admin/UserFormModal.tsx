'use client';

import { useState, useEffect } from 'react';
import type { User, Sector } from '@/lib/types';
import { sectorsApi } from '@/lib/api';
import { X } from 'lucide-react';
import PermissionsEditor from './PermissionsEditor';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'commander', label: 'Comandante' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'operator', label: 'Operador' },
  { value: 'field_unit', label: 'Unidad de Campo' },
];

const SHIFTS = [
  { value: '', label: 'Sin turno asignado' },
  { value: 'morning', label: 'Matutino (06–14h)' },
  { value: 'afternoon', label: 'Vespertino (14–22h)' },
  { value: 'night', label: 'Nocturno (22–06h)' },
];

interface UserFormModalProps {
  user?: User | null;
  onSubmit: (data: {
    name: string;
    email: string;
    password: string;
    role: string;
    badgeNumber: string;
    sectorId: string;
    shift: string;
    customPermissions: string[];
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
  const [sectorId, setSectorId] = useState(user?.sectorId ?? '');
  const [shift, setShift] = useState(user?.shift ?? '');
  const [customPermissions, setCustomPermissions] = useState<string[]>(user?.customPermissions ?? []);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [showPermissions, setShowPermissions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    sectorsApi.getAll().then(setSectors).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEdit && password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmit({ name, email, password, role, badgeNumber, sectorId, shift, customPermissions });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelClass = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white border border-gray-200 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="text-gray-900 font-semibold text-lg">
            {isEdit ? 'Editar usuario' : 'Nuevo usuario'}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {error && (
            <p className="text-red-600 text-xs mb-4 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Nombre completo</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            {!isEdit && (
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label className={labelClass}>
                {isEdit ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required={!isEdit}
                minLength={8}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Rol</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className={inputClass}
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Turno</label>
                <select
                  value={shift}
                  onChange={e => setShift(e.target.value)}
                  className={inputClass}
                >
                  {SHIFTS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Número de placa</label>
                <input
                  value={badgeNumber}
                  onChange={e => setBadgeNumber(e.target.value)}
                  placeholder="Opcional"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Sector asignado</label>
                <select
                  value={sectorId}
                  onChange={e => setSectorId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Sin sector</option>
                  {sectors.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Permisos adicionales — solo al editar */}
            {isEdit && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowPermissions(p => !p)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium">Permisos adicionales</span>
                  <span className="text-gray-400 text-xs">{showPermissions ? '▲ Ocultar' : '▼ Mostrar'}</span>
                </button>
                {showPermissions && (
                  <div className="px-4 pb-4 pt-2 bg-gray-50">
                    <PermissionsEditor
                      role={role}
                      customPermissions={customPermissions}
                      onChange={setCustomPermissions}
                    />
                  </div>
                )}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button
            type="submit"
            form="user-form"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            {loading ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2.5 text-sm transition-colors border border-gray-200"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
