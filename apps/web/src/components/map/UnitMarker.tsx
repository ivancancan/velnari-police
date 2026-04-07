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
  onClick?: () => void;
}

export default function UnitMarker({ callSign, status, onClick }: UnitMarkerProps) {
  const color = STATUS_COLORS[status] ?? '#64748B';
  const label = STATUS_LABELS[status] ?? status;

  return (
    <button
      onClick={onClick}
      title={`${callSign} — ${label}`}
      className="group relative flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-lg cursor-pointer hover:scale-110 transition-transform"
      style={{ backgroundColor: color }}
      aria-label={`Unidad ${callSign}`}
    >
      <span className="text-white text-xs font-bold font-mono leading-none">
        {callSign.replace('P-', '')}
      </span>
      {/* Tooltip */}
      <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900 text-signal-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-slate-700">
        {callSign}
      </span>
    </button>
  );
}
