'use client';
import { useEffect, useState } from 'react';
import { unitsApi, sectorsApi } from '@/lib/api';
import { reportError } from '@/lib/report-error';
import type { Unit, Sector } from '@/lib/types';
import { Truck, Plus, Pencil, PowerOff } from 'lucide-react';
import UnitFormModal from '@/components/admin/UnitFormModal';

const STATUS_LABELS: Record<string, string> = {
  available: 'Disponible',
  en_route: 'En camino',
  on_scene: 'En escena',
  out_of_service: 'Fuera de servicio',
};

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  en_route: 'bg-blue-100 text-blue-700',
  on_scene: 'bg-amber-100 text-amber-700',
  out_of_service: 'bg-gray-100 text-gray-500',
};

export default function AdminUnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; unit?: Unit } | null>(null);

  function load() {
    setLoading(true);
    Promise.all([unitsApi.getAll({}), sectorsApi.getAll()])
      .then(([uRes, sData]) => {
        setUnits(uRes.data);
        setSectors(sData);
      })
      .catch((err) => reportError(err, { tag: 'admin.units' }))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleSave(data: { callSign: string; sectorId: string; shift: string }) {
    if (modal?.mode === 'edit' && modal.unit) {
      await unitsApi.update(modal.unit.id, {
        callSign: data.callSign,
        sectorId: data.sectorId || undefined,
        shift: data.shift || undefined,
      });
    } else {
      await unitsApi.create({
        callSign: data.callSign,
        sectorId: data.sectorId || undefined,
        shift: data.shift || undefined,
      });
    }
    setModal(null);
    load();
  }

  async function handleDeactivate(unit: Unit) {
    if (!confirm(`¿Desactivar la unidad ${unit.callSign}?`)) return;
    await unitsApi.update(unit.id, { isActive: false });
    load();
  }

  const sectorMap = Object.fromEntries(sectors.map(s => [s.id, s.name]));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Unidades</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {units.length} unidad{units.length !== 1 ? 'es' : ''} activa{units.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={15} />
          Nueva unidad
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Cargando unidades…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-medium">Unidad</th>
                <th className="px-5 py-3 text-left font-medium">Estado</th>
                <th className="px-5 py-3 text-left font-medium">Sector</th>
                <th className="px-5 py-3 text-left font-medium">Turno</th>
                <th className="px-5 py-3 text-left font-medium">Última ubicación</th>
                <th className="px-5 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {units.map(unit => (
                <tr key={unit.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
                        <Truck size={13} className="text-blue-600" />
                      </div>
                      <span className="font-medium text-gray-900">{unit.callSign}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[unit.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABELS[unit.status] ?? unit.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">
                    {unit.sectorId ? (sectorMap[unit.sectorId] ?? '—') : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{unit.shift ?? '—'}</td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">
                    {unit.lastLocationAt
                      ? new Date(unit.lastLocationAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
                      : 'Sin datos'}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setModal({ mode: 'edit', unit })}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDeactivate(unit)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Desactivar"
                      >
                        <PowerOff size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {units.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-400 text-sm">
                    No hay unidades registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <UnitFormModal
          unit={modal.unit}
          sectors={sectors}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
