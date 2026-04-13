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
import DispatchQueue from '@/components/incidents/DispatchQueue';
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
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 gap-4 animate-pulse">
      <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-700" />
      <div className="flex flex-col items-center gap-2">
        <div className="h-3 w-32 bg-slate-800 rounded" />
        <div className="h-2 w-20 bg-slate-800 rounded" />
      </div>
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
  const [sidebarTab, setSidebarTab] = useState<'incidents' | 'dispatch' | 'patrols' | 'chat'>('incidents');
  const [crisisMode, setCrisisMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false);
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
          setSidebarTab('dispatch');
          break;
        case '3':
          setSidebarTab('patrols');
          break;
        case '4':
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
        <header className="flex items-center justify-between px-4 lg:px-6 py-3 bg-slate-900 border-b border-slate-800 shrink-0 gap-2">
          {/* Left: brand + nav */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-bold text-signal-white tracking-tight truncate">
              Velnari
            </span>
            <span className="hidden sm:inline text-xs text-slate-gray font-mono shrink-0">
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
              <Link href="/admin" className="hidden md:inline text-xs text-slate-gray hover:text-signal-white transition-colors duration-200">
                Usuarios
              </Link>
            )}
          </div>

          {/* Center (desktop only): map controls + status */}
          <div className="hidden lg:flex items-center gap-2">
            {sectors.length > 0 && (
              <select
                onChange={(e) => {
                  if (!e.target.value) return;
                  setDrawSectorId(e.target.value);
                  e.target.value = '';
                }}
                className="text-xs bg-slate-800 border border-slate-700 text-slate-gray rounded px-2 py-1 min-h-[28px] focus:outline-none focus:ring-1 focus:ring-tactical-blue"
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

          {/* Right (desktop): crisis + user + shortcuts */}
          <div className="hidden lg:flex items-center gap-3">
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
            {(user?.role === 'admin' || user?.role === 'commander' || user?.role === 'supervisor') && (
              <Link
                href="/insights"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-signal-white transition-all"
              >
                Insights
              </Link>
            )}
            <button
              onClick={clearAuth}
              className="text-xs text-slate-gray hover:text-signal-white transition-colors duration-200"
            >
              Salir
            </button>
          </div>

          {/* Mobile right cluster: notifications + hamburger */}
          <div className="flex lg:hidden items-center gap-2 shrink-0">
            <NotificationBell />
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Abrir menú"
              aria-expanded={mobileMenuOpen}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-200 active:bg-slate-700"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {mobileMenuOpen ? (
                  <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                ) : (
                  <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
                )}
              </svg>
            </button>
          </div>
        </header>

        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-40 top-[57px]" onClick={() => setMobileMenuOpen(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative ml-auto w-72 max-w-[85vw] h-[calc(100dvh-57px)] bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto"
            >
              <div className="px-4 py-3 border-b border-slate-800">
                <p className="text-xs text-slate-500">Sesión</p>
                <p className="text-sm text-signal-white truncate">{user?.name}</p>
                <p className="text-[11px] text-slate-gray capitalize">{user?.role}</p>
              </div>
              <nav className="flex flex-col py-2">
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-sm text-slate-200 active:bg-slate-800">Dashboard</Link>
                {(user?.role === 'admin' || user?.role === 'commander' || user?.role === 'supervisor') && (
                  <Link href="/insights" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-sm text-slate-200 active:bg-slate-800">Insights</Link>
                )}
                {user?.role === 'admin' && (
                  <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-sm text-slate-200 active:bg-slate-800">Usuarios</Link>
                )}
                <Link href="/ayuda" target="_blank" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-sm text-slate-200 active:bg-slate-800">Ayuda</Link>
              </nav>
              <div className="px-4 py-3 border-t border-slate-800 flex flex-col gap-2">
                <button
                  onClick={() => { setShowHeatmap((v) => !v); setMobileMenuOpen(false); }}
                  className={`text-xs px-3 py-2 rounded border transition-colors ${
                    showHeatmap ? 'bg-alert-amber text-midnight-command border-alert-amber' : 'bg-slate-800 text-slate-gray border-slate-700'
                  }`}
                >
                  Mapa de calor {showHeatmap ? '· ON' : ''}
                </button>
                <button
                  onClick={() => { setShowCoverage((v) => !v); setMobileMenuOpen(false); }}
                  className={`text-xs px-3 py-2 rounded border transition-colors ${
                    showCoverage ? 'bg-green-500 text-midnight-command border-green-500' : 'bg-slate-800 text-slate-gray border-slate-700'
                  }`}
                >
                  Cobertura {showCoverage ? '· ON' : ''}
                </button>
                <button
                  onClick={() => {
                    if (!crisisMode) {
                      if (confirm('¿Activar modo crisis? Esto alertará a todos los operadores.')) {
                        setCrisisMode(true);
                        setSidebarTab('incidents');
                        setMobileMenuOpen(false);
                      }
                    } else {
                      setCrisisMode(false);
                      setMobileMenuOpen(false);
                    }
                  }}
                  className={`text-xs px-3 py-2 rounded border font-semibold transition-all ${
                    crisisMode ? 'bg-red-600 text-white border-red-500' : 'bg-slate-800 text-slate-gray border-slate-700'
                  }`}
                >
                  {crisisMode ? 'CRISIS ACTIVA' : 'Modo crisis'}
                </button>
              </div>
              <div className="mt-auto px-4 py-3 border-t border-slate-800">
                <button onClick={clearAuth} className="w-full text-sm text-red-400 py-2">Salir</button>
              </div>
            </div>
          </div>
        )}

        {crisisMode && (
          <div className="bg-red-600 text-white text-center py-2 text-sm font-semibold animate-pulse shrink-0">
            ⚠️ MODO CRISIS ACTIVO — Todas las unidades en alerta máxima
          </div>
        )}

        {/* Main content */}
        <div id="main-content" className="flex flex-1 overflow-hidden relative">
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

          <aside
            className={`
              lg:w-[300px] xl:w-[380px] lg:shrink-0 lg:static lg:translate-y-0 lg:h-auto lg:border-l lg:border-t-0
              fixed left-0 right-0 bottom-0 z-30 bg-slate-900 border-t border-slate-800 rounded-t-2xl lg:rounded-none flex flex-col overflow-hidden shadow-2xl shadow-black/40 lg:shadow-none
              transition-transform duration-300 ease-out
              ${mobileSheetExpanded ? 'h-[80dvh] translate-y-0' : 'h-[45dvh] translate-y-0'}
            `}
          >
            {/* Mobile drag handle */}
            <button
              onClick={() => setMobileSheetExpanded((v) => !v)}
              aria-label={mobileSheetExpanded ? 'Contraer panel' : 'Expandir panel'}
              className="lg:hidden w-full flex flex-col items-center pt-2 pb-1 active:bg-slate-800/50 transition-colors"
            >
              <span className="block w-10 h-1 rounded-full bg-slate-600" />
            </button>
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
                    onClick={() => setSidebarTab('dispatch')}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors duration-200 relative ${
                      sidebarTab === 'dispatch' ? 'text-signal-white border-b-2 border-alert-amber' : 'text-slate-gray hover:text-signal-white/70'
                    }`}
                  >
                    Despacho
                    {incidents.filter((i) => i.status === 'open').length > 0 && (
                      <span className="absolute top-1.5 right-1 bg-alert-amber text-midnight-command text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                        {incidents.filter((i) => i.status === 'open').length}
                      </span>
                    )}
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
                ) : sidebarTab === 'dispatch' ? (
                  <DispatchQueue />
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
