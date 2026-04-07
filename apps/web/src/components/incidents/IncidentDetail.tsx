import type { Incident } from '@/lib/types';

export default function IncidentDetail({
  incident,
  onBack,
}: {
  incident: Incident;
  onBack: () => void;
}) {
  return (
    <div className="p-4">
      <button onClick={onBack} className="text-slate-gray text-sm mb-2">← Volver</button>
      <p className="text-signal-white">{incident.folio}</p>
    </div>
  );
}
