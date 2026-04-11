import type { UnitStatus } from '@velnari/shared-types';

const STATUS_CONFIG: Record<string, { color: string; glow: string; label: string; emoji: string; pulse: boolean }> = {
  available:       { color: '#22C55E', glow: '#22C55E40', label: 'Disponible',        emoji: '🚔', pulse: false },
  en_route:        { color: '#3B82F6', glow: '#3B82F660', label: 'En ruta',            emoji: '🚓', pulse: true  },
  on_scene:        { color: '#F59E0B', glow: '#F59E0B60', label: 'En escena',          emoji: '👮', pulse: true  },
  out_of_service:  { color: '#475569', glow: '#47556940', label: 'Fuera de servicio',  emoji: '⛔', pulse: false },
};

interface UnitMarkerProps {
  callSign: string;
  status: UnitStatus;
  batteryLevel?: number;
  onClick?: () => void;
}

export default function UnitMarker({ callSign, status, batteryLevel, onClick }: UnitMarkerProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['out_of_service']!;
  const batteryLow = batteryLevel != null && batteryLevel < 0.15;
  const batteryPct = batteryLevel != null ? Math.round(batteryLevel * 100) : null;
  const unitNum = callSign.replace(/^P-0?/, '');

  return (
    <button
      onClick={onClick}
      title={`${callSign} — ${cfg.label}${batteryPct != null ? ` · ${batteryPct}%` : ''}`}
      aria-label={`Unidad ${callSign}`}
      className="group relative flex flex-col items-center cursor-pointer hover:scale-110 transition-transform duration-200 select-none"
    >
      {/* Outer glow ring — pulses for active units */}
      {cfg.pulse && (
        <span
          className="absolute inset-0 rounded-xl animate-pulse-ring pointer-events-none"
          style={{ border: `2px solid ${cfg.color}`, borderRadius: '10px' }}
        />
      )}

      {/* Main badge */}
      <span
        className="relative flex items-center gap-1 px-2 py-1 rounded-xl border border-white/20 shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${cfg.color}ee, ${cfg.color}bb)`,
          boxShadow: `0 2px 12px ${cfg.glow}, inset 0 1px 0 rgba(255,255,255,0.2)`,
        }}
      >
        {/* Emoji icon */}
        <span className="text-base leading-none" role="img" aria-hidden>
          {cfg.emoji}
        </span>

        {/* Callsign */}
        <span className="text-white text-[11px] font-bold font-mono leading-none tracking-wide">
          {callSign}
        </span>

        {/* Battery low badge */}
        {batteryLow && (
          <span
            className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 border border-white/80 text-[9px] animate-pulse"
            title="Batería baja"
          >
            🔋
          </span>
        )}
      </span>

      {/* Battery bar */}
      {batteryPct != null && (
        <span className="mt-0.5 w-10 h-1.5 rounded-full bg-slate-700/80 overflow-hidden border border-slate-600/60">
          <span
            className="block h-full rounded-full transition-all duration-300"
            style={{
              width: `${batteryPct}%`,
              backgroundColor: batteryPct > 50 ? '#22C55E' : batteryPct > 15 ? '#F59E0B' : '#EF4444',
            }}
          />
        </span>
      )}

      {/* Pointer pin */}
      <span
        className="w-0 h-0"
        style={{
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderTop: `6px solid ${cfg.color}`,
          marginTop: '-1px',
          filter: `drop-shadow(0 1px 2px ${cfg.glow})`,
        }}
      />

      {/* Glassmorphism tooltip */}
      <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-signal-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none border border-white/10 bg-slate-900/80 backdrop-blur-lg shadow-xl z-50">
        {cfg.emoji} {callSign} · {cfg.label}{batteryPct != null ? ` · 🔋${batteryPct}%` : ''}
      </span>
    </button>
  );
}
