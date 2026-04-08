// apps/web/src/app/command/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useIncidentsStore } from '@/store/incidents.store';
import { useUnitsStore } from '@/store/units.store';
import { incidentsApi, unitsApi, sectorsApi } from '@/lib/api';
import dynamic from 'next/dynamic';
import IncidentList from '@/components/incidents/IncidentList';
import RealtimeProvider from '@/components/incidents/RealtimeProvider';
import UnitDetailPanel from '@/components/units/UnitDetailPanel';
import type { LocationHistoryPoint, Sector, SectorWithBoundary } from '@/lib/types';
import ToastContainer from '@/components/ui/ToastContainer';
import Link from 'next/link';

const CommandMap = dynamic(() => import('@/components/map/CommandMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-slate-900">
      <p className="text-slate-gray">Cargando mapa...</p>
    </div>
  ),
});

export default function CommandPage() {
  const { isAuthenticated, user, clearAuth } = useAuthStore();
  const { setIncidents, setLoading } = useIncidentsStore();
  const { setUnits, units, selectedUnitId } = useUnitsStore();
  const [trailPoints, setTrailPoints] = useState<LocationHistoryPoint[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [sectorsWithBoundary, setSectorsWithBoundary] = useState<SectorWithBoundary[]>([]);
  const [drawSectorId, setDrawSectorId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    setLoading(true);
    incidentsApi
      .getAll()
      .then((res) => setIncidents(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [setIncidents, setLoading]);

  useEffect(() => {
    unitsApi
      .getAll()
      .then((res) => setUnits(res.data))
      .catch(console.error);
  }, [setUnits]);

  useEffect(() => {
    sectorsApi.getAll().then((res) => setSectors(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    sectorsApi.getWithBoundary().then((res) => setSectorsWithBoundary(res.data)).catch(console.error);
  }, []);

  if (!isAuthenticated) return null;

  const selectedUnit = selectedUnitId
    ? units.find((u) => u.id === selectedUnitId) ?? null
    : null;

  return (
    <RealtimeProvider>
      <div className="flex flex-col h-screen bg-midnight-command">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-bold text-signal-white tracking-tight">
              Velnari Command
            </span>
            <span className="text-xs text-slate-gray font-mono">
              {new Date().toLocaleDateString('es-MX', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
              })}
            </span>
            <Link href="/dashboard" className="text-xs text-slate-gray hover:text-signal-white transition-colors ml-2">
              Dashboard →
            </Link>
            {user?.role === 'admin' && (
              <Link href="/admin" className="text-xs text-slate-gray hover:text-signal-white">
                Usuarios
              </Link>
            )}
            {sectors.length > 0 && (
              <select
                onChange={(e) => {
                  if (!e.target.value) return;
                  setDrawSectorId(e.target.value);
                  e.target.value = '';
                }}
                className="text-xs bg-slate-800 border border-slate-700 text-slate-gray rounded px-2 py-1 focus:outline-none"
                defaultValue=""
                aria-label="Dibujar geocerca"
              >
                <option value="">+ Geocerca</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-gray">{user?.name}</span>
            <button
              onClick={clearAuth}
              className="text-xs text-slate-gray hover:text-signal-white transition-colors"
            >
              Salir
            </button>
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 relative">
            <CommandMap
              trailPoints={trailPoints}
              sectors={sectorsWithBoundary}
              drawSectorId={drawSectorId}
              onBoundarySet={() => {
                setDrawSectorId(null);
                sectorsApi.getWithBoundary().then((res) => setSectorsWithBoundary(res.data)).catch(console.error);
              }}
            />
          </div>

          <aside className="w-[380px] shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">
            {selectedUnit ? (
              <UnitDetailPanel
                unit={selectedUnit}
                onTrailChange={setTrailPoints}
              />
            ) : (
              <IncidentList sectors={sectors} />
            )}
          </aside>
        </div>
      </div>
      <ToastContainer />
    </RealtimeProvider>
  );
}
