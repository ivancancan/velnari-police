'use client';
import { useState } from 'react';
import { X } from 'lucide-react';

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#06B6D4', '#F97316', '#84CC16',
];

interface Props {
  sector?: { id: string; name: string; color: string } | null;
  onSave: (data: { name: string; color: string }) => void;
  onClose: () => void;
}

export default function SectorFormModal({ sector, onSave, onClose }: Props) {
  const [name, setName] = useState(sector?.name ?? '');
  const [color, setColor] = useState(sector?.color ?? '#3B82F6');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-gray-900 font-semibold">
            {sector ? 'Editar Sector' : 'Nuevo Sector'}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5">
              Nombre
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Sector Norte"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
              Color en mapa
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    color === c ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-gray-600 text-sm hover:text-gray-900 transition-colors rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => name.trim() && onSave({ name: name.trim(), color })}
            disabled={!name.trim()}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
