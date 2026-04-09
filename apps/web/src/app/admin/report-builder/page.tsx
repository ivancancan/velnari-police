'use client';
import { useEffect, useState, useCallback } from 'react';
import { reportsApi } from '@/lib/api';
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  FileText,
  Save,
  Loader2,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TemplateField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  fields: TemplateField[];
  createdAt: string;
  updatedAt: string;
}

// ─── Field palette ──────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { type: 'text', label: 'Texto corto', icon: 'Aa' },
  { type: 'textarea', label: 'Texto largo', icon: '¶' },
  { type: 'number', label: 'Número', icon: '#' },
  { type: 'select', label: 'Selección única', icon: '\u25be' },
  { type: 'multiselect', label: 'Selección múltiple', icon: '\u2611' },
  { type: 'date', label: 'Fecha', icon: '\ud83d\udcc5' },
  { type: 'checkbox', label: 'Casilla Sí/No', icon: '\u2713' },
];

let fieldCounter = 0;
function makeField(type: string): TemplateField {
  fieldCounter += 1;
  return {
    id: `field-${Date.now()}-${fieldCounter}`,
    type,
    label: '',
    required: false,
    options: type === 'select' || type === 'multiselect' ? [''] : undefined,
  };
}

// ─── Template List View ─────────────────────────────────────────────────────

function TemplateList({
  templates,
  loading,
  onNew,
  onEdit,
  onDelete,
}: {
  templates: ReportTemplate[];
  loading: boolean;
  onNew: () => void;
  onEdit: (t: ReportTemplate) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Constructor de Reportes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Diseña templates de reporte que los operadores llenarán en campo.
          </p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          Nuevo template
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-gray-200 rounded-xl">
          <FileText size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No hay templates aún.</p>
          <button
            onClick={onNew}
            className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Crear el primero
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              onClick={() => onEdit(t)}
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-blue-500" />
                  <h3 className="font-medium text-gray-900 text-sm">{t.name || 'Sin nombre'}</h3>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(t.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {t.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{t.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{t.fields?.length ?? 0} campos</span>
                <span>·</span>
                <span>{new Date(t.createdAt).toLocaleDateString('es-MX')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Field Editor Card ──────────────────────────────────────────────────────

function FieldCard({
  field,
  index,
  total,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  field: TemplateField;
  index: number;
  total: number;
  onChange: (f: TemplateField) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const meta = FIELD_TYPES.find((ft) => ft.type === field.type);

  const updateOption = (i: number, value: string) => {
    const opts = [...(field.options ?? [])];
    opts[i] = value;
    onChange({ ...field, options: opts });
  };

  const removeOption = (i: number) => {
    const opts = (field.options ?? []).filter((_, idx) => idx !== i);
    onChange({ ...field, options: opts.length > 0 ? opts : [''] });
  };

  const addOption = () => {
    onChange({ ...field, options: [...(field.options ?? []), ''] });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 group hover:border-gray-300 transition-colors">
      {/* Header row */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-gray-400 text-lg w-6 text-center select-none">
          {meta?.icon ?? '?'}
        </span>
        <input
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          placeholder="Nombre del campo"
          className="flex-1 font-medium text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-0.5 text-sm bg-transparent"
        />
        <label className="flex items-center gap-1.5 text-xs text-gray-500 whitespace-nowrap cursor-pointer select-none">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onChange({ ...field, required: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Requerido
        </label>
        <div className="flex items-center gap-0.5 ml-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Mover arriba"
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Mover abajo"
          >
            <ChevronDown size={14} />
          </button>
          <button
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors ml-0.5"
            title="Eliminar campo"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Options editor for select / multiselect */}
      {(field.type === 'select' || field.type === 'multiselect') && (
        <div className="ml-9 space-y-1.5 mb-3">
          <p className="text-xs text-gray-400 font-medium mb-1">Opciones:</p>
          {(field.options ?? []).map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Opción ${i + 1}`}
                className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:border-blue-500 focus:outline-none bg-gray-50"
              />
              <button
                onClick={() => removeOption(i)}
                className="p-0.5 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button
            onClick={addOption}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
          >
            + Agregar opción
          </button>
        </div>
      )}

      {/* Preview */}
      <div className="ml-9 mt-2 opacity-40 pointer-events-none">
        {field.type === 'text' && (
          <input
            placeholder={field.label || 'Texto corto'}
            disabled
            className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 bg-gray-50"
          />
        )}
        {field.type === 'textarea' && (
          <textarea
            placeholder={field.label || 'Texto largo'}
            disabled
            rows={2}
            className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 bg-gray-50 resize-none"
          />
        )}
        {field.type === 'number' && (
          <input
            type="number"
            placeholder="0"
            disabled
            className="w-40 text-sm border border-gray-200 rounded px-2.5 py-1.5 bg-gray-50"
          />
        )}
        {field.type === 'select' && (
          <select disabled className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 bg-gray-50 text-gray-400">
            <option>Seleccionar...</option>
          </select>
        )}
        {field.type === 'multiselect' && (
          <div className="text-xs text-gray-400 border border-gray-200 rounded px-2.5 py-1.5 bg-gray-50">
            Selección múltiple...
          </div>
        )}
        {field.type === 'date' && (
          <input
            type="date"
            disabled
            className="w-48 text-sm border border-gray-200 rounded px-2.5 py-1.5 bg-gray-50"
          />
        )}
        {field.type === 'checkbox' && (
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input type="checkbox" disabled className="rounded border-gray-300" />
            {field.label || 'Sí / No'}
          </label>
        )}
      </div>
    </div>
  );
}

// ─── Template Editor View ───────────────────────────────────────────────────

function TemplateEditor({
  initial,
  onBack,
  onSaved,
}: {
  initial?: ReportTemplate;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [fields, setFields] = useState<TemplateField[]>(initial?.fields ?? []);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const addField = (type: string) => {
    setFields((prev) => [...prev, makeField(type)]);
  };

  const updateField = (index: number, updated: TemplateField) => {
    setFields((prev) => prev.map((f, i) => (i === index ? updated : f)));
  };

  const moveField = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    setFields((prev) => {
      const next = [...prev];
      const temp = next[index]!;
      next[index] = next[target]!;
      next[target] = temp;
      return next;
    });
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('El nombre del template es requerido', 'error');
      return;
    }
    if (fields.length === 0) {
      showToast('Agrega al menos un campo', 'error');
      return;
    }
    const emptyLabels = fields.some((f) => !f.label.trim());
    if (emptyLabels) {
      showToast('Todos los campos necesitan un nombre', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = { name: name.trim(), description: description.trim() || undefined, fields };
      if (initial?.id) {
        await reportsApi.updateTemplate(initial.id, payload);
        showToast('Template actualizado');
      } else {
        await reportsApi.createTemplate(payload);
        showToast('Template creado');
      }
      setTimeout(() => {
        onSaved();
        onBack();
      }, 800);
    } catch {
      showToast('Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} />
            Volver
          </button>
          <div className="flex-1 min-w-0">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del template"
              className="w-full text-lg font-semibold text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none pb-0.5 bg-transparent"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción (opcional)"
              className="w-full text-sm text-gray-500 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none mt-1 pb-0.5 bg-transparent"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Guardar template
          </button>
        </div>
      </div>

      {/* Body: sidebar + canvas */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — field palette */}
        <aside className="w-56 bg-white border-r border-gray-200 p-4 flex-shrink-0 overflow-y-auto">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-3">
            Campos disponibles
          </p>
          <div className="space-y-1.5">
            {FIELD_TYPES.map((ft) => (
              <button
                key={ft.type}
                onClick={() => addField(ft.type)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all text-left"
              >
                <span className="w-5 text-center text-base text-gray-400">{ft.icon}</span>
                {ft.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-4 leading-relaxed">
            Haz clic en un campo para agregarlo al formulario.
          </p>
        </aside>

        {/* Center canvas */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Plus size={24} className="text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium">
                Aún no hay campos
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Selecciona un tipo de campo del panel izquierdo para comenzar.
              </p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-3">
              {fields.map((field, i) => (
                <FieldCard
                  key={field.id}
                  field={field}
                  index={i}
                  total={fields.length}
                  onChange={(updated) => updateField(i, updated)}
                  onMoveUp={() => moveField(i, -1)}
                  onMoveDown={() => moveField(i, 1)}
                  onRemove={() => removeField(i)}
                />
              ))}
              <div className="text-center pt-2">
                <p className="text-xs text-gray-400">
                  {fields.length} campo{fields.length !== 1 && 's'} · Agrega más desde el panel izquierdo
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ReportBuilderPage() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editing, setEditing] = useState<ReportTemplate | undefined>(undefined);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportsApi.getTemplates();
      setTemplates(res.data);
    } catch {
      // API may not exist yet — show empty state
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este template? Esta acción no se puede deshacer.')) return;
    try {
      await reportsApi.deleteTemplate(id);
      showToast('Template eliminado');
      loadTemplates();
    } catch {
      showToast('Error al eliminar', 'error');
    }
  };

  if (view === 'editor') {
    return (
      <TemplateEditor
        initial={editing}
        onBack={() => {
          setView('list');
          setEditing(undefined);
        }}
        onSaved={loadTemplates}
      />
    );
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {toast.msg}
        </div>
      )}
      <TemplateList
        templates={templates}
        loading={loading}
        onNew={() => {
          setEditing(undefined);
          setView('editor');
        }}
        onEdit={(t) => {
          setEditing(t);
          setView('editor');
        }}
        onDelete={handleDelete}
      />
    </>
  );
}
