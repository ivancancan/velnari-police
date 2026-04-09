'use client';
import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';

export default function ConnectionStatus() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const check = () => {
      try {
        const socket = getSocket();
        setConnected(socket?.connected ?? false);
      } catch {
        setConnected(false);
      }
    };
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1.5" title={connected ? 'Conectado al servidor' : 'Sin conexión al servidor'}>
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
      <span className="text-xs text-slate-400">{connected ? 'En vivo' : 'Desconectado'}</span>
    </div>
  );
}
