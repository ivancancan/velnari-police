'use client';
import { useState } from 'react';

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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-sm border border-slate-700 shadow-2xl">
        <h2 className="text-white font-semibold text-lg mb-5">
          {sector ? 'Editar Sector' : 'Nuevo Sector'}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-xs font-medium uppercase tracking-wide">Nombre</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full mt-1.5 bg-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-600"
              placeholder="Ej: Sector Norte"
              autoFocus
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs font-medium uppercase tracking-wide">Color en mapa</label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-slate-400 text-sm hover:text-white transition-colors rounded-lg border border-slate-600 hover:border-slate-500"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => name.trim() && onSave({ name: name.trim(), color })}
            disabled={!name.trim()}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
