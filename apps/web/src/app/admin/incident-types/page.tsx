'use client';
import { useState } from 'react';
import { Pencil, Check, X, AlertTriangle, GripVertical } from 'lucide-react';

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#10B981', '#06B6D4', '#3B82F6',
  '#8B5CF6', '#EC4899', '#6B7280', '#0F172A',
];

interface IncidentTypeConfig {
  key: string;
  label: string;
  description: string;
  color: string;
  isActive: boolean;
}

const DEFAULT_TYPES: IncidentTypeConfig[] = [
  { key: 'robbery', label: 'Robo', description: 'Sustracción de bienes con o sin violencia', color: '#EF4444', isActive: true },
  { key: 'assault', label: 'Agresión', description: 'Agresión física o amenaza a persona', color: '#F97316', isActive: true },
  { key: 'traffic', label: 'Accidente vial', description: 'Colisión o incidente de tránsito', color: '#F59E0B', isActive: true },
  { key: 'noise', label: 'Ruido / alteración', description: 'Ruido excesivo o alteración del orden público', color: '#8B5CF6', isActive: true },
  { key: 'domestic', label: 'Violencia doméstica', description: 'Incidente de violencia en el hogar', color: '#EC4899', isActive: true },
  { key: 'missing_person', label: 'Persona desaparecida', description: 'Reporte de persona no localizada', color: '#06B6D4', isActive: true },
  { key: 'other', label: 'Otro', description: 'Incidente no categorizado', color: '#6B7280', isActive: true },
];

const STORAGE_KEY = 'velnari_incident_types_config';

function loadConfig(): IncidentTypeConfig[] {
  if (typeof window === 'undefined') return DEFAULT_TYPES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TYPES;
    const saved = JSON.parse(raw) as Partial<IncidentTypeConfig>[];
    return DEFAULT_TYPES.map(def => {
      const override = saved.find(s => s.key === def.key);
      return override ? { ...def, ...override } : def;
    });
  } catch {
    return DEFAULT_TYPES;
  }
}

function saveConfig(types: IncidentTypeConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
}

export default function IncidentTypesPage() {
  const [types, setTypes] = useState<IncidentTypeConfig[]>(loadConfig);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<IncidentTypeConfig>>({});
  const [saved, setSaved] = useState(false);

  function startEdit(t: IncidentTypeConfig) {
    setEditingKey(t.key);
    setEditDraft({ label: t.label, description: t.description, color: t.color });
  }

  function commitEdit() {
    if (!editingKey) return;
    const updated = types.map(t =>
      t.key === editingKey ? { ...t, ...editDraft } : t,
    );
    setTypes(updated);
    saveConfig(updated);
    setEditingKey(null);
    flash();
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditDraft({});
  }

  function toggleActive(key: string) {
    const updated = types.map(t => t.key === key ? { ...t, isActive: !t.isActive } : t);
    setTypes(updated);
    saveConfig(updated);
    flash();
  }

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tipos de Incidente</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configura las categorías de incidente disponibles para los operadores</p>
        </div>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <Check size={14} /> Guardado
          </span>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 grid grid-cols-[32px_180px_1fr_160px_80px_80px] gap-4 text-xs text-gray-500 font-medium uppercase tracking-wide">
          <div></div>
          <div>Categoría</div>
          <div>Descripción</div>
          <div>Color</div>
          <div className="text-center">Activo</div>
          <div></div>
        </div>

        <div className="divide-y divide-gray-100">
          {types.map(type => (
            <div key={type.key} className={`px-5 py-3.5 grid grid-cols-[32px_180px_1fr_160px_80px_80px] gap-4 items-center ${!type.isActive ? 'opacity-50' : ''}`}>
              {/* Drag handle (visual only) */}
              <GripVertical size={14} className="text-gray-300" />

              {/* Label */}
              <div>
                {editingKey === type.key ? (
                  <input
                    value={editDraft.label ?? ''}
                    onChange={e => setEditDraft(d => ({ ...d, label: e.target.value }))}
                    className="w-full border border-blue-300 rounded px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: type.color }}
                    />
                    <span className="text-sm font-medium text-gray-900">{type.label}</span>
                    <span className="text-xs text-gray-400 font-mono">({type.key})</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                {editingKey === type.key ? (
                  <input
                    value={editDraft.description ?? ''}
                    onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
                    className="w-full border border-blue-300 rounded px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <span className="text-sm text-gray-500">{type.description}</span>
                )}
              </div>

              {/* Color */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {editingKey === type.key ? (
                  PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditDraft(d => ({ ...d, color: c }))}
                      className={`w-5 h-5 rounded-full border-2 transition-transform ${
                        (editDraft.color ?? type.color) === c
                          ? 'border-gray-900 scale-125'
                          : 'border-transparent hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))
                ) : (
                  <div
                    className="w-6 h-6 rounded-md border border-gray-200"
                    style={{ backgroundColor: type.color }}
                  />
                )}
              </div>

              {/* Toggle active */}
              <div className="flex justify-center">
                <button
                  onClick={() => toggleActive(type.key)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    type.isActive ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  title={type.isActive ? 'Desactivar' : 'Activar'}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                      type.isActive ? 'translate-x-4.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-1">
                {editingKey === type.key ? (
                  <>
                    <button
                      onClick={commitEdit}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => startEdit(type)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
        <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          Los cambios se guardan localmente. En la siguiente versión esta configuración se sincronizará con el servidor para que aplique a todos los operadores.
        </p>
      </div>
    </div>
  );
}
