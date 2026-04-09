'use client';
import { useState } from 'react';
import type { Unit, Sector } from '@/lib/types';
import { X } from 'lucide-react';

interface Props {
  unit?: Unit;
  sectors: Sector[];
  onSave: (data: { callSign: string; sectorId: string; shift: string }) => Promise<void>;
  onClose: () => void;
}

const SHIFTS = ['Matutino', 'Vespertino', 'Nocturno', '24x24'];

export default function UnitFormModal({ unit, sectors, onSave, onClose }: Props) {
  const [callSign, setCallSign] = useState(unit?.callSign ?? '');
  const [sectorId, setSectorId] = useState(unit?.sectorId ?? '');
  const [shift, setShift] = useState(unit?.shift ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!unit;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!callSign.trim()) { setError('La clave de unidad es requerida'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ callSign: callSign.trim(), sectorId, shift });
    } catch {
      setError('Error al guardar la unidad');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editar unidad' : 'Nueva unidad'}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Clave de unidad <span className="text-red-500">*</span>
            </label>
            <input
              value={callSign}
              onChange={e => setCallSign(e.target.value)}
              placeholder="P-01"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Sector asignado</label>
            <select
              value={sectorId}
              onChange={e => setSectorId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sin sector</option>
              {sectors.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Turno</label>
            <select
              value={shift}
              onChange={e => setShift(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sin turno</option>
              {SHIFTS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear unidad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
