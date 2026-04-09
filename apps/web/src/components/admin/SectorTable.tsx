'use client';
import type { SectorWithBoundary } from '@/lib/types';

interface Props {
  sectors: SectorWithBoundary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (sector: SectorWithBoundary) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export default function SectorTable({ sectors, selectedId, onSelect, onEdit, onDelete, onNew }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-900 font-semibold text-sm">Sectores ({sectors.length})</h3>
        <button
          onClick={onNew}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
        >
          + Nuevo
        </button>
      </div>

      <div className="space-y-1 overflow-y-auto flex-1 pr-1">
        {sectors.map(s => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors group ${
              selectedId === s.id
                ? 'bg-blue-50 border border-blue-300'
                : 'hover:bg-gray-50 border border-transparent'
            }`}
          >
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-gray-900 text-sm flex-1 truncate">{s.name}</span>
            <span className={`text-xs flex-shrink-0 ${s.boundaryGeoJson ? 'text-green-600' : 'text-amber-500'}`}>
              {s.boundaryGeoJson ? '✓' : '⚠'}
            </span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button
                onClick={e => { e.stopPropagation(); onEdit(s); }}
                className="text-gray-400 hover:text-gray-700 text-xs w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100"
                title="Editar nombre / color"
              >
                ✎
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDelete(s.id); }}
                className="text-gray-400 hover:text-red-500 text-xs w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100"
                title="Eliminar sector"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        {sectors.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-10">
            No hay sectores.<br/>
            <span className="text-xs">Crea uno para empezar.</span>
          </p>
        )}
      </div>

      {selectedId && (
        <div className="mt-4 px-3 py-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-blue-700 text-xs font-medium">Modo edición activo</p>
          <p className="text-blue-500 text-xs mt-0.5">
            Usa el botón <span className="text-amber-500 font-semibold">Dibujar geocerca</span> en el mapa.
          </p>
        </div>
      )}
    </div>
  );
}
