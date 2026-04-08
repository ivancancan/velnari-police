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
import PatrolPanel from '@/components/patrols/PatrolPanel';
import type { LocationHistoryPoint, Sector, SectorWithBoundary, HeatmapPoint } from '@/lib/types';
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
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapPoints, setHeatmapPoints] = useState<HeatmapPoint[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'incidents' | 'patrols'>('incidents');
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
    sectorsApi.getAll().then((data) => setSectors(data)).catch(console.error);
  }, []);

  useEffect(() => {
    sectorsApi.getWithBoundary().then((data) => setSectorsWithBoundary(data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!showHeatmap) return;
    const today = new Date().toISOString().split('T')[0];
    incidentsApi
      .getHeatmap(today + 'T00:00:00Z', today + 'T23:59:59Z')
      .then((res) => setHeatmapPoints(res.data))
      .catch(console.error);
  }, [showHeatmap]);

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
            <button
              onClick={() => setShowHeatmap((v) => !v)}
              className={`text-xs px-3 py-1 rounded border ${
                showHeatmap
                  ? 'bg-alert-amber text-midnight-command border-alert-amber'
                  : 'bg-slate-800 text-slate-gray border-slate-700 hover:text-signal-white'
              }`}
            >
              Mapa de calor
            </button>
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
                sectorsApi.getWithBoundary().then((data) => setSectorsWithBoundary(data)).catch(console.error);
              }}
              heatmapPoints={showHeatmap ? heatmapPoints : []}
            />
          </div>

          <aside className="w-[380px] shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">
            {selectedUnit ? (
              <UnitDetailPanel
                unit={selectedUnit}
                onTrailChange={setTrailPoints}
              />
            ) : (
              <>
                <div className="flex border-b border-slate-800">
                  <button
                    onClick={() => setSidebarTab('incidents')}
                    className={`flex-1 py-2 text-xs font-medium ${
                      sidebarTab === 'incidents' ? 'text-signal-white border-b-2 border-tactical-blue' : 'text-slate-gray'
                    }`}
                  >
                    Incidentes
                  </button>
                  <button
                    onClick={() => setSidebarTab('patrols')}
                    className={`flex-1 py-2 text-xs font-medium ${
                      sidebarTab === 'patrols' ? 'text-signal-white border-b-2 border-tactical-blue' : 'text-slate-gray'
                    }`}
                  >
                    Patrullajes
                  </button>
                </div>
                {sidebarTab === 'incidents' ? (
                  <IncidentList sectors={sectors} />
                ) : (
                  <PatrolPanel units={units} sectors={sectors} />
                )}
              </>
            )}
          </aside>
        </div>
      </div>
      <ToastContainer />
    </RealtimeProvider>
  );
}
