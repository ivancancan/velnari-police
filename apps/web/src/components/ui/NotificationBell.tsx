'use client';

import { useState, useRef, useEffect } from 'react';
import { useAlertsStore } from '@/store/alerts.store';
import { Bell } from 'lucide-react';

const PRIORITY_STYLES: Record<string, { dot: string; text: string }> = {
  critical: { dot: 'bg-red-500', text: 'text-red-400' },
  high: { dot: 'bg-orange-500', text: 'text-orange-400' },
  geofence: { dot: 'bg-amber-500', text: 'text-amber-400' },
  stale: { dot: 'bg-purple-500', text: 'text-purple-400' },
};

export default function NotificationBell() {
  const { history, unreadCount, markAllRead } = useAlertsStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function handleOpen() {
    setOpen((v) => !v);
    if (!open && unreadCount > 0) markAllRead();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative p-1.5 text-slate-gray hover:text-signal-white transition-colors"
        title="Notificaciones"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-slate-900/95 backdrop-blur-lg border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-signal-white">
              Notificaciones
            </h3>
            <span className="text-xs text-slate-gray">{history.length} total</span>
          </div>
          <div className="overflow-y-auto max-h-72">
            {history.length === 0 ? (
              <p className="text-center text-slate-gray text-xs py-8">
                Sin notificaciones
              </p>
            ) : (
              history.slice(0, 50).map((alert) => {
                const style = PRIORITY_STYLES[alert.priority] ?? {
                  dot: 'bg-slate-500',
                  text: 'text-slate-400',
                };
                const ago = formatTimeAgo(alert.createdAt);
                return (
                  <div
                    key={alert.id}
                    className="px-4 py-3 border-b border-slate-800 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${style.dot}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${style.text}`}>
                          {alert.folio}
                        </p>
                        <p className="text-sm text-signal-white line-clamp-2 mt-0.5">
                          {alert.message}
                        </p>
                        <p className="text-xs text-slate-gray mt-1">{ago}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const secs = Math.floor((Date.now() - timestamp) / 1000);
  if (secs < 60) return 'Ahora';
  if (secs < 3600) return `Hace ${Math.floor(secs / 60)} min`;
  if (secs < 86400) return `Hace ${Math.floor(secs / 3600)}h`;
  return new Date(timestamp).toLocaleDateString('es-MX');
}
