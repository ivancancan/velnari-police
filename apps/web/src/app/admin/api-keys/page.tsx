'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { reportError } from '@/lib/report-error';
import { Key, Plus, Trash2, Copy, Check, AlertTriangle } from 'lucide-react';

// Admin UI for managing API keys used by 3rd-party systems (C5 Jalisco,
// 911 CAD, legacy dispatch consoles). Flow: admin creates a key, UI shows
// the raw key ONCE with a copy button, admin pastes it into the external
// system. After that, only the prefix + usage stats are ever visible.

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string | null;
  useCount: number;
  isActive: boolean;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<ApiKey[]>('/api-keys')
      .then((res) => setKeys(res.data))
      .catch((err) => reportError(err, { tag: 'admin.apiKeys.list' }))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate() {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const res = await api.post<{ rawKey: string }>('/api-keys', {
        name: name.trim(),
      });
      setNewRawKey(res.data.rawKey);
      setName('');
      load();
    } catch (err) {
      reportError(err, { tag: 'admin.apiKeys.create' });
      if (typeof window !== 'undefined') window.alert('No se pudo crear la API key.');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string, name: string) {
    if (!window.confirm(`¿Revocar la API key "${name}"? El sistema externo dejará de funcionar inmediatamente.`)) return;
    try {
      await api.delete(`/api-keys/${id}`);
      load();
    } catch (err) {
      reportError(err, { tag: 'admin.apiKeys.revoke' });
      if (typeof window !== 'undefined') window.alert('No se pudo revocar la API key.');
    }
  }

  async function copyToClipboard(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      if (typeof window !== 'undefined') window.alert('Copia manual: ' + value);
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Key size={20} /> API Keys
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Credenciales para integrar sistemas externos (C5, 911, CAD legacy).
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={15} /> Nueva API Key
        </button>
      </div>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Cargando API keys…</div>
        ) : keys.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-sm">Sin API keys configuradas.</p>
            <p className="text-xs mt-1">Crea una para conectar tu C5 o sistema de 911.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Nombre</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Prefijo</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Uso</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Último uso</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Creada</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map((k) => (
                <tr key={k.id} className={k.isActive ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 font-medium">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {k.prefix}…
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{k.useCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {k.lastUsedAt
                      ? new Date(k.lastUsedAt).toLocaleString('es-MX')
                      : 'nunca'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(k.createdAt).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {k.isActive ? (
                      <button
                        onClick={() => handleRevoke(k.id, k.name)}
                        className="text-red-600 hover:text-red-700 text-xs font-medium inline-flex items-center gap-1"
                      >
                        <Trash2 size={13} /> Revocar
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">Revocada</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowCreate(false); setNewRawKey(null); }}>
          <div
            className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {!newRawKey ? (
              <>
                <h2 className="text-base font-semibold text-gray-900 mb-1">Nueva API Key</h2>
                <p className="text-xs text-gray-500 mb-4">
                  Elige un nombre que identifique al sistema que usará la clave.
                </p>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. C5 Jalisco — ingesta ciudadana"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                  maxLength={120}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setShowCreate(false); setName(''); }}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!name.trim() || creating}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {creating ? 'Creando…' : 'Crear'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">API Key creada</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Cópiala ahora — no volverá a mostrarse. Si la pierdes, tendrás que revocarla y crear una nueva.
                    </p>
                  </div>
                </div>
                <div className="bg-gray-900 text-green-400 font-mono text-xs rounded-lg p-3 break-all mb-3">
                  {newRawKey}
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => copyToClipboard(newRawKey)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copiada' : 'Copiar'}
                  </button>
                  <button
                    onClick={() => { setShowCreate(false); setNewRawKey(null); }}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Listo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-900">
        <p className="font-semibold mb-1">Cómo usar una API Key</p>
        <p className="leading-relaxed mb-2">
          El sistema externo debe enviar incidentes a <code className="bg-white px-1 py-0.5 rounded">POST /api/ingest/incidents</code> con el header <code className="bg-white px-1 py-0.5 rounded">Authorization: Bearer vnrk_...</code>.
        </p>
        <p>
          Ver documentación completa en <code className="bg-white px-1 py-0.5 rounded">/api/docs#/ingest</code>.
        </p>
      </div>
    </div>
  );
}
