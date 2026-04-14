'use client';

import dynamic from 'next/dynamic';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { incidentsApi, dispatchApi } from '@/lib/api';
import { useIncidentsStore } from '@/store/incidents.store';
import { IncidentType, IncidentPriority } from '@velnari/shared-types';
import { MapPin, X } from 'lucide-react';
import { reportError } from '@/lib/report-error';

const LocationPickerMap = dynamic(() => import('./LocationPickerMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-800 rounded-lg">
      <span className="text-slate-500 text-xs">Cargando mapa…</span>
    </div>
  ),
});

const TYPE_LABELS: Record<string, string> = {
  robbery:        'Robo',
  assault:        'Agresión',
  traffic:        'Accidente vial',
  noise:          'Ruido / alteración',
  domestic:       'Violencia doméstica',
  missing_person: 'Persona desaparecida',
  other:          'Otro',
};

const PRIORITY_LABELS: Record<string, string> = {
  low:      'Baja',
  medium:   'Media',
  high:     'Alta',
  critical: 'Crítica',
};

const createIncidentSchema = z.object({
  type: z.nativeEnum(IncidentType, { errorMap: () => ({ message: 'Tipo requerido' }) }),
  priority: z.nativeEnum(IncidentPriority, { errorMap: () => ({ message: 'Prioridad requerida' }) }),
  lat: z.number({ invalid_type_error: 'Selecciona la ubicación en el mapa', required_error: 'Selecciona la ubicación en el mapa' }).min(-90).max(90),
  lng: z.number({ invalid_type_error: 'Selecciona la ubicación en el mapa', required_error: 'Selecciona la ubicación en el mapa' }).min(-180).max(180),
  address: z.string().max(200).optional(),
  description: z.string().min(5).max(500).optional().or(z.literal('')),
});

type FormData = z.infer<typeof createIncidentSchema>;

interface Props {
  onClose: () => void;
}

export default function CreateIncidentModal({ onClose }: Props) {
  const addIncident = useIncidentsStore((s) => s.addIncident);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(createIncidentSchema),
    defaultValues: { lat: undefined, lng: undefined },
  });

  const lat = watch('lat');
  const lng = watch('lng');

  function handlePick(pickedLat: number, pickedLng: number) {
    setValue('lat', pickedLat, { shouldValidate: true });
    setValue('lng', pickedLng, { shouldValidate: true });
  }

  const onSubmit = async (data: FormData) => {
    try {
      const res = await incidentsApi.create({
        type: data.type,
        priority: data.priority,
        lat: data.lat,
        lng: data.lng,
        address: data.address || undefined,
        description: data.description || undefined,
      });
      addIncident(res.data);

      // Auto-suggest the nearest available unit and prompt the operator to
      // confirm with 1 click. No suggestion = silent close (no unit available).
      try {
        const suggestionsRes = await dispatchApi.getSuggestions(res.data.id);
        const top = suggestionsRes.data[0];
        if (top) {
          const confirmed = window.confirm(
            `Sugerencia de despacho:\n\n${top.callSign} · ${top.distanceKm.toFixed(1)} km · ${top.incidentsToday} incidentes hoy\n\n¿Asignar ahora?`,
          );
          if (confirmed) {
            try {
              await dispatchApi.assignUnit(res.data.id, top.unitId);
            } catch (err) {
              reportError(err, { tag: 'incident.autoAssign' });
            }
          }
        }
      } catch (err) {
        // Non-fatal — incident already created, just no auto-dispatch.
        reportError(err, { tag: 'incident.getSuggestions' });
      }

      onClose();
    } catch {
      setError('root', { message: 'Error al crear el incidente.' });
    }
  };

  const selectClass =
    'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-signal-white text-sm focus:outline-none focus:border-tactical-blue transition-colors';
  const inputClass =
    'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-signal-white text-sm focus:outline-none focus:border-tactical-blue transition-colors';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-signal-white">Nuevo incidente</h2>
          <button onClick={onClose} className="text-slate-gray hover:text-signal-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body — two columns */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left — form */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-4 px-6 py-4 overflow-y-auto border-r border-slate-700">
            {/* Type */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-gray uppercase tracking-wider">Tipo</label>
              <select {...register('type')} className={selectClass}>
                <option value="">Seleccionar tipo…</option>
                {Object.values(IncidentType).map(v => (
                  <option key={v} value={v}>{TYPE_LABELS[v] ?? v}</option>
                ))}
              </select>
              {errors.type && <span className="text-red-400 text-xs">{errors.type.message}</span>}
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-gray uppercase tracking-wider">Prioridad</label>
              <select {...register('priority')} className={selectClass}>
                <option value="">Seleccionar prioridad…</option>
                {Object.values(IncidentPriority).map(v => (
                  <option key={v} value={v}>{PRIORITY_LABELS[v] ?? v}</option>
                ))}
              </select>
              {errors.priority && <span className="text-red-400 text-xs">{errors.priority.message}</span>}
            </div>

            {/* Location read-only display */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-gray uppercase tracking-wider flex items-center gap-1">
                <MapPin size={11} /> Ubicación
              </label>
              {lat !== undefined && lng !== undefined ? (
                <div className="bg-slate-800 border border-tactical-blue/50 rounded-lg px-3 py-2 text-xs font-mono text-tactical-blue">
                  {lat.toFixed(5)}, {lng.toFixed(5)}
                </div>
              ) : (
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-500">
                  Haz clic en el mapa →
                </div>
              )}
              {(errors.lat || errors.lng) && (
                <span className="text-red-400 text-xs">Selecciona la ubicación en el mapa</span>
              )}
            </div>

            {/* Address */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-gray uppercase tracking-wider">Dirección (opcional)</label>
              <input
                type="text"
                placeholder="Calle, colonia…"
                {...register('address')}
                className={inputClass}
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-gray uppercase tracking-wider">Descripción (opcional)</label>
              <textarea
                rows={3}
                placeholder="Detalles del incidente…"
                {...register('description')}
                className={`${inputClass} resize-none`}
              />
              {errors.description && <span className="text-red-400 text-xs">{errors.description.message}</span>}
            </div>

            {errors.root && <p className="text-red-400 text-sm">{errors.root.message}</p>}
          </div>

          {/* Right — map */}
          <div className="flex-1 p-3">
            <LocationPickerMap
              lat={lat ?? null}
              lng={lng ?? null}
              onPick={handlePick}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-slate-700 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-slate-700 text-slate-gray hover:text-signal-white py-2 rounded-lg text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="flex-1 bg-tactical-blue hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
          >
            {isSubmitting ? 'Creando…' : 'Crear incidente'}
          </button>
        </div>
      </div>
    </div>
  );
}
