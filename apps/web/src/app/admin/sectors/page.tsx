'use client';
import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { sectorsApi } from '@/lib/api';
import type { SectorWithBoundary } from '@/lib/types';
import SectorTable from '@/components/admin/SectorTable';
import SectorFormModal from '@/components/admin/SectorFormModal';
import { Plus } from 'lucide-react';

const SectorDrawMap = dynamic(() => import('@/components/admin/SectorDrawMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <span className="text-gray-400 text-sm">Cargando mapa…</span>
    </div>
  ),
});

export default function SectorsAdminPage() {
  const [sectors, setSectors] = useState<SectorWithBoundary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; sector?: SectorWithBoundary } | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadSectors = useCallback(async () => {
    try {
      const data = await sectorsApi.getWithBoundary();
      setSectors(data);
    } catch {
      showToast('Error al cargar sectores', 'error');
    }
  }, []);

  useEffect(() => { loadSectors(); }, [loadSectors]);

  const handleSaveModal = async (data: { name: string; color: string }) => {
    setSaving(true);
    try {
      if (modal?.mode === 'edit' && modal.sector) {
        await sectorsApi.update(modal.sector.id, data);
        showToast('Sector actualizado');
      } else {
        const created = await sectorsApi.create(data);
        setSelectedId(created.id);
        showToast('Sector creado — dibuja su geocerca en el mapa');
      }
      await loadSectors();
      setModal(null);
    } catch {
      showToast('Error al guardar sector', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleBoundaryDrawn = async (sectorId: string, coords: [number, number][]) => {
    setSaving(true);
    try {
      await sectorsApi.setBoundary(sectorId, coords);
      await loadSectors();
      showToast('Geocerca guardada');
    } catch {
      showToast('Error al guardar geocerca', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este sector? Esta acción no se puede deshacer.')) return;
    try {
      await sectorsApi.delete(id);
      if (selectedId === id) setSelectedId(null);
      await loadSectors();
      showToast('Sector eliminado');
    } catch {
      showToast('Error al eliminar sector', 'error');
    }
  };

  return (
    // Use calc to fill parent's overflow-y-auto container height
    <div className="flex flex-col" style={{ height: 'calc(100vh - 0px)' }}>
      {/* Sub-header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Sectores y Geocercas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {sectors.length} sector{sectors.length !== 1 ? 'es' : ''} configurado{sectors.length !== 1 ? 's' : ''}
            {saving && <span className="ml-2 text-blue-500">Guardando…</span>}
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={15} />
          Nuevo sector
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3">
            <SectorTable
              sectors={sectors}
              selectedId={selectedId}
              onSelect={id => setSelectedId(id === selectedId ? null : id)}
              onEdit={s => setModal({ mode: 'edit', sector: s })}
              onDelete={handleDelete}
              onNew={() => setModal({ mode: 'create' })}
            />
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <SectorDrawMap
            sectors={sectors}
            selectedSectorId={selectedId}
            onBoundaryDrawn={handleBoundaryDrawn}
          />
          {!selectedId && sectors.length > 0 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="bg-white/90 backdrop-blur rounded-lg px-4 py-2 border border-gray-200 shadow-md">
                <p className="text-gray-600 text-xs text-center">Selecciona un sector para editar su geocerca</p>
              </div>
            </div>
          )}
          {!selectedId && sectors.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white/90 rounded-xl px-8 py-6 text-center border border-gray-200 shadow-md">
                <p className="text-gray-700 text-sm font-medium">No hay sectores aún</p>
                <p className="text-gray-400 text-xs mt-1">Crea un sector para comenzar</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-sm shadow-xl z-50 ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {modal && (
        <SectorFormModal
          sector={modal.mode === 'edit' ? (modal.sector ?? null) : null}
          onSave={handleSaveModal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
