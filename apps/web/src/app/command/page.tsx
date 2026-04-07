'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useIncidentsStore } from '@/store/incidents.store';
import { incidentsApi } from '@/lib/api';
import dynamic from 'next/dynamic';
import IncidentList from '@/components/incidents/IncidentList';
import RealtimeProvider from '@/components/incidents/RealtimeProvider';

// MapLibre GL uses browser APIs — load without SSR
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

  if (!isAuthenticated) return null;

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
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-gray">
            {user?.name}
          </span>
          <button
            onClick={clearAuth}
            className="text-xs text-slate-gray hover:text-signal-white transition-colors"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Main content: map + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map takes remaining space */}
        <div className="flex-1 relative">
          <CommandMap />
        </div>

        {/* Incidents sidebar */}
        <aside className="w-[380px] shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">
          <IncidentList />
        </aside>
      </div>
    </div>
    </RealtimeProvider>
  );
}
