'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '@/components/ui/Modal';
import { incidentsApi } from '@/lib/api';
import { useIncidentsStore } from '@/store/incidents.store';
import { IncidentType, IncidentPriority } from '@velnari/shared-types';

const createIncidentSchema = z.object({
  type: z.nativeEnum(IncidentType, { errorMap: () => ({ message: 'Tipo requerido' }) }),
  priority: z.nativeEnum(IncidentPriority, {
    errorMap: () => ({ message: 'Prioridad requerida' }),
  }),
  lat: z
    .number({ invalid_type_error: 'Latitud requerida', required_error: 'Latitud requerida' })
    .min(-90)
    .max(90),
  lng: z
    .number({ invalid_type_error: 'Longitud requerida', required_error: 'Longitud requerida' })
    .min(-180)
    .max(180),
  address: z.string().max(200).optional(),
  description: z.string().min(5).max(500).optional().or(z.literal('')),
});

type CreateIncidentFormData = z.infer<typeof createIncidentSchema>;

interface CreateIncidentModalProps {
  onClose: () => void;
}

export default function CreateIncidentModal({ onClose }: CreateIncidentModalProps) {
  const addIncident = useIncidentsStore((s) => s.addIncident);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CreateIncidentFormData>({
    resolver: zodResolver(createIncidentSchema),
    defaultValues: {
      lat: undefined,
      lng: undefined,
    },
  });

  const onSubmit = async (data: CreateIncidentFormData) => {
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
      onClose();
    } catch {
      setError('root', { message: 'Error al crear el incidente.' });
    }
  };

  const inputClass =
    'w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white text-sm focus:outline-none focus:border-tactical-blue';

  return (
    <Modal isOpen title="Nuevo incidente" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Type */}
        <div className="flex flex-col gap-1">
          <label htmlFor="type" className="text-xs text-slate-gray uppercase tracking-wider">
            Tipo
          </label>
          <select id="type" {...register('type')} className={inputClass}>
            <option value="">Seleccionar tipo...</option>
            {Object.entries(IncidentType).map(([key, value]) => (
              <option key={key} value={value}>
                {key.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
          {errors.type && <span className="text-red-400 text-xs">{errors.type.message}</span>}
        </div>

        {/* Priority */}
        <div className="flex flex-col gap-1">
          <label htmlFor="priority" className="text-xs text-slate-gray uppercase tracking-wider">
            Prioridad
          </label>
          <select id="priority" {...register('priority')} className={inputClass}>
            <option value="">Seleccionar prioridad...</option>
            {Object.entries(IncidentPriority).map(([key, value]) => (
              <option key={key} value={value}>
                {key.charAt(0) + key.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          {errors.priority && (
            <span className="text-red-400 text-xs">{errors.priority.message}</span>
          )}
        </div>

        {/* Lat / Lng */}
        <div className="flex gap-3">
          <div className="flex flex-col gap-1 flex-1">
            <label htmlFor="lat" className="text-xs text-slate-gray uppercase tracking-wider">
              Latitud
            </label>
            <input
              id="lat"
              type="number"
              step="any"
              placeholder="19.4326"
              {...register('lat', { valueAsNumber: true })}
              className={inputClass}
            />
            {errors.lat && <span className="text-red-400 text-xs">{errors.lat.message}</span>}
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label htmlFor="lng" className="text-xs text-slate-gray uppercase tracking-wider">
              Longitud
            </label>
            <input
              id="lng"
              type="number"
              step="any"
              placeholder="-99.1332"
              {...register('lng', { valueAsNumber: true })}
              className={inputClass}
            />
            {errors.lng && <span className="text-red-400 text-xs">{errors.lng.message}</span>}
          </div>
        </div>

        {/* Address */}
        <div className="flex flex-col gap-1">
          <label htmlFor="address" className="text-xs text-slate-gray uppercase tracking-wider">
            Dirección (opcional)
          </label>
          <input
            id="address"
            type="text"
            placeholder="Calle, colonia..."
            {...register('address')}
            className={inputClass}
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label htmlFor="description" className="text-xs text-slate-gray uppercase tracking-wider">
            Descripción (opcional)
          </label>
          <textarea
            id="description"
            rows={2}
            placeholder="Detalles del incidente..."
            {...register('description')}
            className={`${inputClass} resize-none`}
          />
        </div>

        {errors.root && (
          <p className="text-red-400 text-sm">{errors.root.message}</p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-slate-700 text-slate-gray hover:text-signal-white py-2 rounded text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-tactical-blue hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-2 rounded text-sm transition-colors"
          >
            {isSubmitting ? 'Creando...' : 'Crear incidente'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
