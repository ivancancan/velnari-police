'use client';

import { useState, useEffect } from 'react';
import type { Incident, IncidentEvent, Attachment } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import AssignUnitModal from './AssignUnitModal';
import type { IncidentPriority, IncidentStatus } from '@velnari/shared-types';
import { IncidentStatus as IS } from '@velnari/shared-types';
import { attachmentsApi } from '@/lib/api';

const TYPE_LABELS: Record<string, string> = {
  robbery: 'Robo',
  assault: 'Agresión',
  traffic: 'Tráfico',
  noise: 'Ruido',
  domestic: 'Doméstico',
  missing_person: 'Persona desaparecida',
  other: 'Otro',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  created: '🟢 Creado',
  assigned: '🔵 Asignado',
  en_route: '🚔 En ruta',
  on_scene: '📍 En escena',
  note: '📝 Nota',
  closed: '⛔ Cerrado',
};

interface IncidentDetailProps {
  incident: Incident;
  onBack: () => void;
}

export default function IncidentDetail({ incident, onBack }: IncidentDetailProps) {
  const [showAssign, setShowAssign] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const canAssign = incident.status === IS.OPEN || incident.status === IS.ASSIGNED;
  const isClosed = incident.status === IS.CLOSED;

  const events: IncidentEvent[] = incident.events ?? [];

  useEffect(() => {
    if (!incident?.id) return;
    attachmentsApi.getByIncident(incident.id)
      .then((res) => setAttachments(res.data))
      .catch(console.error);
  }, [incident?.id]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !incident?.id) return;
    setUploading(true);
    try {
      const res = await attachmentsApi.upload(incident.id, file);
      setAttachments((prev) => [...prev, res.data]);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
        <button
          onClick={onBack}
          className="text-slate-gray hover:text-signal-white transition-colors text-sm"
          aria-label="Volver a la lista"
        >
          ← Volver
        </button>
        <span className="font-mono text-sm text-signal-white">{incident.folio}</span>
        <Badge variant={incident.priority as IncidentPriority} />
        <Badge variant={incident.status as IncidentStatus} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
        {/* Type + Address */}
        <div>
          <p className="text-base font-semibold text-signal-white">
            {TYPE_LABELS[incident.type] ?? incident.type}
          </p>
          {incident.address && (
            <p className="text-sm text-slate-gray mt-0.5">{incident.address}</p>
          )}
          {incident.description && (
            <p className="text-sm text-slate-400 mt-1">{incident.description}</p>
          )}
        </div>

        {/* Coords */}
        <div className="font-mono text-xs text-slate-gray">
          {incident.lat.toFixed(6)}, {incident.lng.toFixed(6)}
        </div>

        {/* Actions */}
        {!isClosed && (
          <div className="flex gap-2">
            {canAssign && (
              <button
                onClick={() => setShowAssign(true)}
                className="flex-1 bg-tactical-blue hover:bg-blue-600 text-white text-sm font-semibold py-2 rounded transition-colors"
                aria-label="Asignar unidad"
              >
                Asignar unidad
              </button>
            )}
          </div>
        )}

        {/* Timeline */}
        <div>
          <h3 className="text-xs font-semibold text-slate-gray uppercase tracking-wider mb-2">
            Timeline
          </h3>
          {events.length === 0 ? (
            <p className="text-xs text-slate-gray">Sin eventos</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {events.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-slate-600 shrink-0 mt-1" />
                    <div className="w-px flex-1 bg-slate-800" />
                  </div>
                  <div className="pb-2">
                    <p className="text-xs text-slate-gray">
                      {EVENT_TYPE_LABELS[event.type] ?? event.type}
                      {' · '}
                      {new Date(event.createdAt).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="text-sm text-signal-white">{event.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Attachments section */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-gray uppercase tracking-wide">
              Archivos adjuntos
            </h4>
            <label className="cursor-pointer text-xs text-tactical-blue hover:underline">
              {uploading ? 'Subiendo...' : '+ Adjuntar'}
              <input
                type="file"
                accept="image/*,application/pdf,.doc,.docx"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
          </div>

          {attachments.length === 0 ? (
            <p className="text-xs text-slate-gray">Sin archivos adjuntos.</p>
          ) : (
            <div className="space-y-1">
              {attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-signal-white hover:text-tactical-blue"
                >
                  <span className="text-slate-gray">
                    {att.mimetype.startsWith('image/') ? '🖼' : '📄'}
                  </span>
                  <span className="truncate">{att.originalName}</span>
                  <span className="text-slate-gray ml-auto">
                    {(att.size / 1024).toFixed(0)} KB
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Assign unit modal */}
      {showAssign && (
        <AssignUnitModal
          incidentId={incident.id}
          onClose={() => setShowAssign(false)}
        />
      )}
    </div>
  );
}
