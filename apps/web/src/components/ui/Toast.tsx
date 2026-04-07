interface ToastProps {
  id: string;
  folio: string;
  message: string;
  priority: string;
  onDismiss: (id: string) => void;
}

const COLORS: Record<string, { bg: string; border: string; label: string }> = {
  critical: { bg: 'bg-red-950', border: 'border-red-500', label: 'text-red-300' },
  high: { bg: 'bg-orange-950', border: 'border-orange-500', label: 'text-orange-300' },
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'CRÍTICO',
  high: 'ALTO',
};

export default function Toast({ id, folio, message, priority, onDismiss }: ToastProps) {
  const colors = COLORS[priority] ?? COLORS['high']!;
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-2xl max-w-sm w-full ${colors.bg} ${colors.border}`}
      role="alert"
      aria-live="assertive"
    >
      <span className="text-xl shrink-0 mt-0.5">🚨</span>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold uppercase tracking-widest ${colors.label}`}>
          {PRIORITY_LABELS[priority] ?? priority} · {folio}
        </p>
        <p className="text-signal-white text-sm mt-0.5 line-clamp-2">{message}</p>
      </div>
      <button
        onClick={() => onDismiss(id)}
        className="text-slate-400 hover:text-signal-white shrink-0 text-xl leading-none mt-0.5"
        aria-label="Cerrar alerta"
      >
        ×
      </button>
    </div>
  );
}
