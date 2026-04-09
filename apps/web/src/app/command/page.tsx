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
import IncidentDetail from '@/components/incidents/IncidentDetail';
import RealtimeProvider from '@/components/incidents/RealtimeProvider';
import UnitDetailPanel from '@/components/units/UnitDetailPanel';
import PatrolPanel from '@/components/patrols/PatrolPanel';
import ChatPanel from '@/components/chat/ChatPanel';
import type { LocationHistoryPoint, Sector, SectorWithBoundary, HeatmapPoint } from '@/lib/types';
import ToastContainer from '@/components/ui/ToastContainer';
import KeyboardShortcuts from '@/components/ui/KeyboardShortcuts';
import OnboardingTour from '@/components/ui/OnboardingTour';
import Link from 'next/link';

const ConnectionStatus = dynamic(() => import('@/components/ui/ConnectionStatus'), { ssr: false });
const NotificationBell = dynamic(() => import('@/components/ui/NotificationBell'), { ssr: false });

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
  const { setIncidents, setLoading, incidents, selectedId, selectIncident } = useIncidentsStore();
  const { setUnits, units, selectedUnitId, selectUnit } = useUnitsStore();
  const [trailPoints, setTrailPoints] = useState<LocationHistoryPoint[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [sectorsWithBoundary, setSectorsWithBoundary] = useState<SectorWithBoundary[]>([]);
  const [drawSectorId, setDrawSectorId] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showCoverage, setShowCoverage] = useState(false);
  const [heatmapPoints, setHeatmapPoints] = useState<HeatmapPoint[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'incidents' | 'patrols' | 'chat'>('incidents');
  const [crisisMode, setCrisisMode] = useState(false);
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      switch (e.key) {
        case 'Escape':
          if (selectedUnitId) selectUnit(null);
          if (selectedId) selectIncident(null);
          break;
        case '1':
          setSidebarTab('incidents');
          break;
        case '2':
          setSidebarTab('patrols');
          break;
        case '3':
          setSidebarTab('chat');
          break;
        case 'h':
        case 'H':
          window.open('/ayuda', '_blank');
          break;
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedUnitId, selectedId, selectUnit, selectIncident]);

  if (!isAuthenticated) return null;

  const selectedUnit = selectedUnitId
    ? units.find((u) => u.id === selectedUnitId) ?? null
    : null;

  const selectedIncident = selectedId
    ? incidents.find((i) => i.id === selectedId) ?? null
    : null;

  return (
    <RealtimeProvider>
      <div className="flex flex-col h-[100dvh] bg-midnight-command">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
          {/* Left group: brand + nav */}
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
            <span className="hidden md:inline w-px h-5 bg-slate-700" aria-hidden="true" />
            <Link href="/dashboard" className="hidden md:inline text-xs text-slate-gray hover:text-signal-white transition-colors duration-200">
              Dashboard
            </Link>
            {user?.role === 'admin' && (
              <Link href="/admin" className="text-xs text-slate-gray hover:text-signal-white transition-colors duration-200">
                Usuarios
              </Link>
            )}
          </div>

          {/* Center group: map controls + status */}
          <div className="flex items-center gap-2">
            {sectors.length > 0 && (
              <select
                onChange={(e) => {
                  if (!e.target.value) return;
                  setDrawSectorId(e.target.value);
                  e.target.value = '';
                }}
                className="hidden lg:block text-xs bg-slate-800 border border-slate-700 text-slate-gray rounded px-2 py-1 min-h-[28px] focus:outline-none focus:ring-1 focus:ring-tactical-blue"
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
              className={`text-xs px-3 py-1.5 rounded border transition-colors duration-200 ${
                showHeatmap
                  ? 'bg-alert-amber text-midnight-command border-alert-amber'
                  : 'bg-slate-800 text-slate-gray border-slate-700 hover:text-signal-white'
              }`}
            >
              Mapa de calor
            </button>
            <button
              onClick={() => setShowCoverage((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded border transition-colors duration-200 ${
                showCoverage
                  ? 'bg-green-500 text-midnight-command border-green-500'
                  : 'bg-slate-800 text-slate-gray border-slate-700 hover:text-signal-white'
              }`}
            >
              Cobertura
            </button>
            <span className="w-px h-5 bg-slate-700" aria-hidden="true" />
            <ConnectionStatus />
          </div>

          {/* Right group: crisis + user + shortcuts */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (!crisisMode) {
                  if (confirm('¿Activar modo crisis? Esto alertará a todos los operadores.')) {
                    setCrisisMode(true);
                    setSidebarTab('incidents');
                  }
                } else {
                  setCrisisMode(false);
                }
              }}
              className={`text-xs px-4 py-1.5 rounded border font-semibold transition-all duration-200 ${
                crisisMode
                  ? 'bg-red-600 text-white border-red-500 animate-crisis-glow'
                  : 'bg-slate-800 text-slate-gray border-slate-700 hover:border-red-500/50 hover:text-red-400'
              }`}
            >
              {crisisMode ? 'CRISIS ACTIVA' : 'Modo crisis'}
            </button>
            <span className="w-px h-5 bg-slate-700" aria-hidden="true" />
            <NotificationBell />
            <KeyboardShortcuts />
            <Link
              href="/ayuda"
              target="_blank"
              className="text-xs text-slate-gray hover:text-signal-white transition-colors duration-200"
              title="Abrir ayuda"
            >
              Ayuda
            </Link>
            <span className="text-sm text-slate-gray">{user?.name}</span>
            <button
              onClick={clearAuth}
              className="text-xs text-slate-gray hover:text-signal-white transition-colors duration-200"
            >
              Salir
            </button>
          </div>
        </header>

        {crisisMode && (
          <div className="bg-red-600 text-white text-center py-2 text-sm font-semibold animate-pulse shrink-0">
            ⚠️ MODO CRISIS ACTIVO — Todas las unidades en alerta máxima
          </div>
        )}

        {/* Main content */}
        <div id="main-content" className="flex flex-1 overflow-hidden">
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
              showCoverage={showCoverage}
            />
          </div>

          <aside className="w-[300px] lg:w-[380px] shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">
            {selectedUnit ? (
              <UnitDetailPanel
                unit={selectedUnit}
                onTrailChange={setTrailPoints}
              />
            ) : selectedIncident ? (
              <IncidentDetail
                incident={selectedIncident}
                onBack={() => selectIncident(null)}
              />
            ) : (
              <>
                <div className="flex border-b border-slate-800">
                  <button
                    onClick={() => setSidebarTab('incidents')}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors duration-200 ${
                      sidebarTab === 'incidents' ? 'text-signal-white border-b-2 border-tactical-blue' : 'text-slate-gray hover:text-signal-white/70'
                    }`}
                  >
                    Incidentes
                  </button>
                  <button
                    onClick={() => setSidebarTab('patrols')}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors duration-200 ${
                      sidebarTab === 'patrols' ? 'text-signal-white border-b-2 border-tactical-blue' : 'text-slate-gray hover:text-signal-white/70'
                    }`}
                  >
                    Patrullajes
                  </button>
                  <button
                    onClick={() => setSidebarTab('chat')}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors duration-200 ${
                      sidebarTab === 'chat' ? 'text-signal-white border-b-2 border-tactical-blue' : 'text-slate-gray hover:text-signal-white/70'
                    }`}
                  >
                    Chat
                  </button>
                </div>
                <div key={sidebarTab} className="animate-tab-fade-in flex-1 overflow-hidden flex flex-col">
                {sidebarTab === 'incidents' ? (
                  <IncidentList sectors={sectors} crisisMode={crisisMode} />
                ) : sidebarTab === 'patrols' ? (
                  <PatrolPanel units={units} sectors={sectors} />
                ) : (
                  <ChatPanel roomId="command" />
                )}
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
      <ToastContainer />
      <OnboardingTour />
    </RealtimeProvider>
  );
}
