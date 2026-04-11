'use client';
import { useAlertsStore } from '@/store/alerts.store';

export default function ConnectionStatus() {
  const connected = useAlertsStore((s) => s.socketConnected);

  return (
    <div
      className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${
        connected
          ? 'bg-green-900/60 text-green-400'
          : 'bg-amber-900/60 text-amber-400 animate-pulse'
      }`}
      title={connected ? 'Conectado al servidor' : 'Sin conexión al servidor'}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-amber-400'}`}
      />
      {connected ? 'En vivo' : 'Reconectando...'}
    </div>
  );
}
