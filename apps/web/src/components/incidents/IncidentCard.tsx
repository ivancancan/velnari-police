import type { Incident } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import type { IncidentPriority, IncidentStatus } from '@velnari/shared-types';

interface IncidentCardProps {
  incident: Incident;
  isSelected: boolean;
  onClick: () => void;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const TYPE_LABELS: Record<string, string> = {
  robbery: 'Robo',
  assault: 'Agresión',
  traffic: 'Tráfico',
  noise: 'Ruido',
  domestic: 'Doméstico',
  missing_person: 'Persona desaparecida',
  other: 'Otro',
};

const PRIORITY_BORDER: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-amber-400',
  low: 'border-l-green-500',
};

const PRIORITY_GLOW: Record<string, string> = {
  critical: 'hover:shadow-[inset_0_0_0_1px_rgba(239,68,68,0.3),0_0_12px_-4px_rgba(239,68,68,0.4)]',
  high: 'hover:shadow-[inset_0_0_0_1px_rgba(249,115,22,0.3),0_0_12px_-4px_rgba(249,115,22,0.4)]',
  medium: 'hover:shadow-[inset_0_0_0_1px_rgba(251,191,36,0.25),0_0_12px_-4px_rgba(251,191,36,0.3)]',
  low: 'hover:shadow-[inset_0_0_0_1px_rgba(34,197,94,0.25),0_0_12px_-4px_rgba(34,197,94,0.3)]',
};

export default function IncidentCard({ incident, isSelected, onClick }: IncidentCardProps) {
  const borderColor = PRIORITY_BORDER[incident.priority] ?? 'border-l-slate-600';
  const glowEffect = PRIORITY_GLOW[incident.priority] ?? '';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-4 border-b border-slate-800 border-l-[3px] transition-all duration-200 ${borderColor} ${glowEffect} ${
        isSelected ? 'bg-slate-800/80' : 'hover:bg-slate-800/50'
      }`}
      aria-selected={isSelected}
      aria-label={`Incidente ${incident.folio}`}
    >
      {/* Row 1: folio + priority badge + time */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-gray">{incident.folio}</span>
          <Badge variant={incident.priority as IncidentPriority} />
        </div>
        <span className="text-xs text-slate-gray font-mono shrink-0">
          {formatTime(incident.createdAt)}
        </span>
      </div>

      {/* Row 2: incident type */}
      <p className="mt-1.5 text-sm text-signal-white font-semibold leading-snug">
        {TYPE_LABELS[incident.type] ?? incident.type}
      </p>

      {/* Row 3: address + status */}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {incident.address ? (
          <p className="text-xs text-slate-gray truncate">{incident.address}</p>
        ) : (
          <span />
        )}
        <Badge variant={incident.status as IncidentStatus} />
      </div>
    </button>
  );
}
