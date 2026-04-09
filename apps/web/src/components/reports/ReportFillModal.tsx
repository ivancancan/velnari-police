'use client';

import { useState, useEffect } from 'react';
import { reportsApi } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import { CheckCircle } from 'lucide-react';

interface TemplateField {
  id: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'date' | 'checkbox';
  label: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  fields: TemplateField[];
}

interface Props {
  incidentId?: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export default function ReportFillModal({ incidentId, onClose, onSubmitted }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportsApi.getTemplates()
      .then(res => setTemplates(res.data))
      .catch(() => setError('Error al cargar templates'))
      .finally(() => setLoading(false));
  }, []);

  function selectTemplate(t: Template) {
    setSelectedTemplate(t);
    setError('');
    const data: Record<string, unknown> = {};
    t.fields.forEach(f => {
      if (f.type === 'checkbox') data[f.id] = false;
      else if (f.type === 'multiselect') data[f.id] = [];
      else data[f.id] = '';
    });
    setFormData(data);
  }

  function updateField(fieldId: string, value: unknown) {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  }

  function toggleMultiselect(fieldId: string, option: string) {
    setFormData(prev => {
      const current = (prev[fieldId] as string[]) || [];
      const next = current.includes(option)
        ? current.filter(o => o !== option)
        : [...current, option];
      return { ...prev, [fieldId]: next };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate) return;

    for (const field of selectedTemplate.fields) {
      if (field.required) {
        const val = formData[field.id];
        if (val === '' || val === null || val === undefined || (Array.isArray(val) && val.length === 0)) {
          setError(`El campo "${field.label}" es requerido`);
          return;
        }
      }
    }

    setSubmitting(true);
    setError('');
    try {
      await reportsApi.createSubmission({
        templateId: selectedTemplate.id,
        incidentId,
        data: formData,
      });
      setSuccess(true);
      onSubmitted?.();
    } catch {
      setError('Error al enviar el reporte');
    } finally {
      setSubmitting(false);
    }
  }

  function renderField(field: TemplateField) {
    const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-signal-white text-sm focus:outline-none focus:border-tactical-blue transition-colors';

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={formData[field.id] as string ?? ''}
            onChange={e => updateField(field.id, e.target.value)}
            placeholder={field.placeholder || field.label}
            className={inputClass}
          />
        );
      case 'textarea':
        return (
          <textarea
            value={formData[field.id] as string ?? ''}
            onChange={e => updateField(field.id, e.target.value)}
            placeholder={field.placeholder || field.label}
            rows={3}
            className={`${inputClass} resize-none`}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={formData[field.id] as string ?? ''}
            onChange={e => updateField(field.id, e.target.value)}
            placeholder={field.placeholder || '0'}
            className={inputClass}
          />
        );
      case 'select':
        return (
          <select
            value={formData[field.id] as string ?? ''}
            onChange={e => updateField(field.id, e.target.value)}
            className={inputClass}
          >
            <option value="">Seleccionar...</option>
            {field.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'multiselect':
        return (
          <div className="flex flex-wrap gap-2">
            {field.options?.map(opt => {
              const selected = ((formData[field.id] as string[]) || []).includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleMultiselect(field.id, opt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selected
                      ? 'bg-tactical-blue text-white'
                      : 'bg-slate-800 text-slate-gray border border-slate-700 hover:border-tactical-blue'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        );
      case 'date':
        return (
          <input
            type="date"
            value={formData[field.id] as string ?? ''}
            onChange={e => updateField(field.id, e.target.value)}
            className={inputClass}
          />
        );
      case 'checkbox':
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData[field.id] as boolean ?? false}
              onChange={e => updateField(field.id, e.target.checked)}
              className="w-5 h-5 accent-tactical-blue"
            />
            <span className="text-sm text-signal-white">{field.label}</span>
          </label>
        );
      default:
        return null;
    }
  }

  const modalTitle = selectedTemplate
    ? selectedTemplate.name
    : 'Seleccionar template de reporte';

  return (
    <Modal isOpen title={modalTitle} onClose={onClose}>
      {/* Success state */}
      {success ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <CheckCircle size={48} className="text-green-500" />
          <p className="text-signal-white font-semibold text-lg">Reporte enviado</p>
          <p className="text-slate-gray text-sm text-center">
            El reporte se ha guardado correctamente.
          </p>
          <button
            onClick={onClose}
            className="mt-2 px-6 py-2 bg-tactical-blue hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      ) : !selectedTemplate ? (
        /* Template picker */
        <div className="flex flex-col gap-3">
          {loading ? (
            <p className="text-slate-gray text-sm text-center py-4 animate-pulse">
              Cargando templates...
            </p>
          ) : templates.length === 0 ? (
            <p className="text-slate-gray text-sm text-center py-4">
              No hay templates disponibles
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className="text-left bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-tactical-blue rounded-lg p-4 transition-colors"
                >
                  <p className="text-sm font-semibold text-signal-white">{t.name}</p>
                  {t.description && (
                    <p className="text-xs text-slate-gray mt-1">{t.description}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    {t.fields.length} campo{t.fields.length !== 1 ? 's' : ''}
                  </p>
                </button>
              ))}
            </div>
          )}

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <div className="flex gap-2 mt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2 text-slate-gray hover:text-signal-white text-sm transition-colors border border-slate-700 rounded-lg hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        /* Form */
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {selectedTemplate.description && (
            <p className="text-xs text-slate-gray">{selectedTemplate.description}</p>
          )}

          {selectedTemplate.fields.map(field => (
            <div key={field.id} className="flex flex-col gap-1.5">
              {field.type !== 'checkbox' && (
                <label className="text-xs font-semibold text-slate-gray uppercase tracking-wider">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
              )}
              {renderField(field)}
            </div>
          ))}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => { setSelectedTemplate(null); setError(''); }}
              className="flex-1 py-2 text-slate-gray hover:text-signal-white text-sm transition-colors border border-slate-700 rounded-lg hover:bg-slate-800"
            >
              Cambiar template
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg disabled:opacity-40 transition-colors"
            >
              {submitting ? 'Enviando...' : 'Enviar reporte'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
