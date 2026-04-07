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

export default function IncidentCard({ incident, isSelected, onClick }: IncidentCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-slate-800 hover:bg-slate-800 transition-colors ${
        isSelected ? 'bg-slate-800 border-l-2 border-l-tactical-blue' : ''
      }`}
      aria-selected={isSelected}
      aria-label={`Incidente ${incident.folio}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-gray">{incident.folio}</span>
          <Badge variant={incident.priority as IncidentPriority} />
        </div>
        <span className="text-xs text-slate-gray shrink-0">
          {formatTime(incident.createdAt)}
        </span>
      </div>

      <p className="mt-1 text-sm text-signal-white font-medium">
        {TYPE_LABELS[incident.type] ?? incident.type}
      </p>

      {incident.address && (
        <p className="mt-0.5 text-xs text-slate-gray truncate">{incident.address}</p>
      )}

      <div className="mt-1">
        <Badge variant={incident.status as IncidentStatus} />
      </div>
    </button>
  );
}
