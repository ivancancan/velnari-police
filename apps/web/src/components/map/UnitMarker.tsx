import type { UnitStatus } from '@velnari/shared-types';

const STATUS_COLORS: Record<string, string> = {
  available: '#22C55E',
  en_route: '#3B82F6',
  on_scene: '#F59E0B',
  out_of_service: '#64748B',
};

const STATUS_LABELS: Record<string, string> = {
  available: 'Disponible',
  en_route: 'En ruta',
  on_scene: 'En escena',
  out_of_service: 'Fuera de servicio',
};

interface UnitMarkerProps {
  callSign: string;
  status: UnitStatus;
  batteryLevel?: number;
  onClick?: () => void;
}

export default function UnitMarker({ callSign, status, batteryLevel, onClick }: UnitMarkerProps) {
  const color = STATUS_COLORS[status] ?? '#64748B';
  const label = STATUS_LABELS[status] ?? status;
  const batteryLow = batteryLevel != null && batteryLevel < 0.15;
  const batteryPct = batteryLevel != null ? Math.round(batteryLevel * 100) : null;

  const isEnRoute = status === 'en_route';

  return (
    <button
      onClick={onClick}
      title={`${callSign} — ${label}${batteryPct != null ? ` · ${batteryPct}%` : ''}`}
      className="group relative flex items-center justify-center w-9 h-9 rounded-full border-2 border-white/90 shadow-lg cursor-pointer hover:scale-110 transition-transform duration-200"
      style={{ backgroundColor: color }}
      aria-label={`Unidad ${callSign}`}
    >
      {/* Pulse ring for en_route units */}
      {isEnRoute && (
        <span
          className="absolute inset-0 rounded-full animate-pulse-ring pointer-events-none"
          style={{ border: `2px solid ${color}` }}
        />
      )}

      <span className="text-white text-xs font-bold font-mono leading-none">
        {callSign.replace('P-', '')}
      </span>

      {/* Battery low indicator */}
      {batteryLow && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 border border-white text-[8px] animate-pulse">
          !
        </span>
      )}

      {/* Battery bar (always shown if available) */}
      {batteryPct != null && (
        <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 h-2 rounded-full bg-slate-700 overflow-hidden border border-slate-600">
          <span
            className="block h-full rounded-full transition-all duration-200"
            style={{
              width: `${batteryPct}%`,
              backgroundColor: batteryPct > 50 ? '#22C55E' : batteryPct > 15 ? '#F59E0B' : '#EF4444',
            }}
          />
        </span>
      )}

      {/* Glassmorphism tooltip */}
      <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-signal-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none border border-white/10 bg-slate-900/70 backdrop-blur-lg shadow-xl">
        {callSign} · {label}{batteryPct != null ? ` · ${batteryPct}%` : ''}
      </span>
    </button>
  );
}
