interface ToastProps {
  id: string;
  folio: string;
  message: string;
  priority: string;
  onDismiss: (id: string) => void;
  /** Auto-dismiss duration in seconds (default 8) */
  duration?: number;
}

const COLORS: Record<string, { bg: string; border: string; label: string; bar: string }> = {
  critical: { bg: 'bg-red-950/80', border: 'border-red-500', label: 'text-red-300', bar: 'bg-red-500' },
  high:     { bg: 'bg-orange-950/80', border: 'border-orange-500', label: 'text-orange-300', bar: 'bg-orange-500' },
  geofence: { bg: 'bg-amber-950/80', border: 'border-amber-500', label: 'text-amber-300', bar: 'bg-amber-500' },
  stale:    { bg: 'bg-purple-950/80', border: 'border-purple-500', label: 'text-purple-300', bar: 'bg-purple-500' },
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'CRITICO',
  high: 'ALTO',
  geofence: 'GEOCERCA',
  stale: 'SIN MOVIMIENTO',
};

export default function Toast({ id, folio, message, priority, onDismiss, duration = 8 }: ToastProps) {
  const colors = COLORS[priority] ?? COLORS['high']!;
  return (
    <div
      className={`animate-slide-in-right relative flex items-start gap-3 px-4 py-3 rounded-lg border shadow-2xl max-w-sm w-full backdrop-blur-lg overflow-hidden ${colors.bg} ${colors.border}`}
      role="alert"
      aria-live="assertive"
      style={{ '--toast-duration': `${duration}s` } as React.CSSProperties}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold uppercase tracking-widest ${colors.label}`}>
          {PRIORITY_LABELS[priority] ?? priority} · {folio}
        </p>
        <p className="text-signal-white text-sm mt-0.5 line-clamp-2">{message}</p>
      </div>
      <button
        onClick={() => onDismiss(id)}
        className="text-slate-400 hover:text-signal-white shrink-0 text-xl leading-none mt-0.5 min-w-[24px] min-h-[24px] flex items-center justify-center"
        aria-label="Cerrar alerta"
      >
        &times;
      </button>

      {/* Countdown progress bar */}
      <span
        className={`absolute bottom-0 left-0 h-[2px] animate-toast-countdown ${colors.bar}`}
        aria-hidden="true"
      />
    </div>
  );
}
