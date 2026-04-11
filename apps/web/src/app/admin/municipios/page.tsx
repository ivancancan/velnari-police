'use client';

import { useEffect, useState } from 'react';
import { tenantsApi } from '@/lib/api';

type Municipio = {
  id: string;
  name: string;
  state?: string;
  slug?: string;
  contactEmail?: string;
  isActive: boolean;
  createdAt: string;
};

export default function MunicipiosPage() {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createState, setCreateState] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await tenantsApi.getAll();
      setMunicipios(res.data);
    } catch {
      setError('Error al cargar municipios');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await tenantsApi.create({ name: createName.trim(), state: createState.trim() || undefined, contactEmail: createEmail.trim() || undefined });
      setShowCreate(false);
      setCreateName('');
      setCreateState('');
      setCreateEmail('');
      await load();
    } catch {
      setError('Error al crear municipio');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(m: Municipio) {
    try {
      await tenantsApi.update(m.id, { isActive: !m.isActive });
      await load();
    } catch {
      setError('Error al actualizar municipio');
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Municipios</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de tenants — cada municipio es un cliente independiente</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + Nuevo Municipio
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Nuevo Municipio</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Ej: Municipio de Querétaro"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <input
                  value={createState}
                  onChange={(e) => setCreateState(e.target.value)}
                  placeholder="Ej: Querétaro"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email de contacto</label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="contacto@municipio.gob.mx"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm py-2 rounded-lg font-medium transition-colors"
              >
                {creating ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : municipios.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <p className="text-gray-400 text-sm">No hay municipios registrados</p>
          <p className="text-gray-400 text-xs mt-1">Crea el primero con el botón de arriba</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Nombre', 'Estado', 'Slug', 'Email', 'Creado', 'Estado'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {municipios.map((m) => (
                <tr key={m.id} className={`hover:bg-gray-50 ${!m.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                  <td className="px-4 py-3 text-gray-600">{m.state ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{m.slug ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{m.contactEmail ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(m.createdAt).toLocaleDateString('es-MX')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {m.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggle(m)}
                      className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      {m.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-medium text-blue-800 mb-1">¿Cómo funciona el aislamiento de datos?</p>
        <p className="text-xs text-blue-600">
          Cada usuario tiene un <code className="bg-blue-100 px-1 rounded">tenant_id</code> que se incluye en su JWT.
          Los incidentes, unidades y sectores creados por ese usuario se etiquetan automáticamente con el mismo tenant.
          Al asignar usuarios a un municipio, edita su <code className="bg-blue-100 px-1 rounded">tenant_id</code> directamente en la DB hasta que el flujo de asignación de usuarios esté implementado.
        </p>
      </div>
    </div>
  );
}
