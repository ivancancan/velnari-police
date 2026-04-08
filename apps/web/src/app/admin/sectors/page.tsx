'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { sectorsApi } from '@/lib/api';
import type { SectorWithBoundary } from '@/lib/types';
import SectorTable from '@/components/admin/SectorTable';
import SectorFormModal from '@/components/admin/SectorFormModal';

const TABS = [
  { label: 'Usuarios', href: '/admin' },
  { label: 'Sectores / Geocercas', href: '/admin/sectors' },
  { label: 'Reportes por Unidad', href: '/admin/reports' },
];

// SSR desactivado para el mapa
const SectorDrawMap = dynamic(() => import('@/components/admin/SectorDrawMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-800">
      <span className="text-slate-400 text-sm">Cargando mapa…</span>
    </div>
  ),
});

export default function SectorsAdminPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [sectors, setSectors] = useState<SectorWithBoundary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    mode: 'create' | 'edit';
    sector?: SectorWithBoundary;
  } | null>(null);
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
      showToast('Geocerca guardada ✓');
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
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header con tabs */}
      <header className="px-6 pt-4 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold tracking-wide text-white">Administración</h1>
            <p className="text-slate-400 text-xs mt-0.5">Gestiona usuarios, sectores y reportes</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/command" className="text-xs text-slate-400 hover:text-white transition-colors">
              ← Centro de Mando
            </Link>
            {saving && <span className="text-blue-400 text-sm animate-pulse">Guardando…</span>}
          </div>
        </div>
        <nav className="flex gap-1">
          {TABS.map(tab => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                pathname === tab.href
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-slate-600'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Panel izquierdo */}
        <div className="w-72 flex-shrink-0 p-4 border-r border-slate-700 flex flex-col">
          <SectorTable
            sectors={sectors}
            selectedId={selectedId}
            onSelect={id => setSelectedId(id === selectedId ? null : id)}
            onEdit={s => setModal({ mode: 'edit', sector: s })}
            onDelete={handleDelete}
            onNew={() => setModal({ mode: 'create' })}
          />
        </div>

        {/* Mapa */}
        <div className="flex-1 relative">
          <SectorDrawMap
            sectors={sectors}
            selectedSectorId={selectedId}
            onBoundaryDrawn={handleBoundaryDrawn}
          />
          {!selectedId && sectors.length > 0 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="bg-slate-800/90 backdrop-blur rounded-lg px-4 py-2.5 border border-slate-700 shadow-lg">
                <p className="text-slate-300 text-xs text-center">
                  Selecciona un sector para editar su geocerca
                </p>
              </div>
            </div>
          )}
          {!selectedId && sectors.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-slate-800/80 rounded-xl px-8 py-6 text-center border border-slate-700">
                <p className="text-slate-300 text-sm font-medium">No hay sectores aún</p>
                <p className="text-slate-500 text-xs mt-1">
                  Crea un sector en el panel izquierdo para comenzar
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-sm shadow-xl z-50 transition-all ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-700 text-white border border-slate-600'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Modal */}
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
