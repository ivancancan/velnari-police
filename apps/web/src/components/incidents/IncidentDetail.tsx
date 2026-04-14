'use client';

import { useState, useEffect } from 'react';
import type { Incident, IncidentEvent, IncidentAssignment, Attachment } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import AssignUnitModal from './AssignUnitModal';
import ReportFillModal from '@/components/reports/ReportFillModal';
import type { IncidentPriority, IncidentStatus } from '@velnari/shared-types';
import { IncidentStatus as IS } from '@velnari/shared-types';
import { attachmentsApi, incidentsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useIncidentsStore } from '@/store/incidents.store';
import { permissions } from '@/lib/permissions';
import { exportToPdf } from '@/lib/pdf-export';
import IncidentReplay from './IncidentReplay';
import { reportError } from '@/lib/report-error';

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
  escalated: '⬆️ Escalado',
};

interface IncidentDetailProps {
  incident: Incident;
  onBack: () => void;
}

export default function IncidentDetail({ incident, onBack }: IncidentDetailProps) {
  const [showAssign, setShowAssign] = useState(false);
  const [assignments, setAssignments] = useState<IncidentAssignment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [localEvents, setLocalEvents] = useState<IncidentEvent[]>(incident.events ?? []);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [showReassignConfirm, setShowReassignConfirm] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [resolution, setResolution] = useState('');
  const [closing, setClosing] = useState(false);

  const user = useAuthStore((s) => s.user);
  const updateIncident = useIncidentsStore((s) => s.updateIncident);
  const isClosed = incident.status === IS.CLOSED;
  const assignableStatuses: string[] = [IS.OPEN, IS.ASSIGNED, IS.EN_ROUTE, IS.ON_SCENE];
  const canAssign = assignableStatuses.includes(incident.status)
    && permissions.assignUnit(user?.role as never);
  const canClose = !isClosed && permissions.closeIncident(user?.role as never);
  const hasUnit = !!incident.assignedUnitId;

  const events: IncidentEvent[] = localEvents;

  function handleExportPdf() {
    const typeLabel = TYPE_LABELS[incident.type] ?? incident.type;
    const priorityLabel = { critical: 'Critica', high: 'Alta', medium: 'Media', low: 'Baja' }[incident.priority] ?? incident.priority;
    const statusLabel = { open: 'Abierto', assigned: 'Asignado', en_route: 'En ruta', on_scene: 'En escena', closed: 'Cerrado' }[incident.status] ?? incident.status;

    const eventsHtml = events.map(ev => `
      <tr>
        <td>${new Date(ev.createdAt).toLocaleString('es-MX')}</td>
        <td>${EVENT_TYPE_LABELS[ev.type] ?? ev.type}</td>
        <td>${ev.description}</td>
      </tr>
    `).join('');

    const attachmentsHtml = attachments.length > 0
      ? attachments.map(a => `<li>${a.originalName} (${(a.size / 1024).toFixed(0)} KB)</li>`).join('')
      : '<li>Sin archivos adjuntos</li>';

    const assignmentsHtml = assignments.length > 0
      ? assignments.map(a => `
          <tr>
            <td style="font-family:monospace; font-weight:600;">${a.unit?.callSign ?? a.unitId}</td>
            <td>${new Date(a.assignedAt).toLocaleString('es-MX')}</td>
            <td>${a.unassignedAt ? new Date(a.unassignedAt).toLocaleString('es-MX') : 'Activa'}</td>
          </tr>
        `).join('')
      : '';

    const noteEvents = events.filter(ev => ev.type === 'note');
    const notesHtml = noteEvents.length > 0
      ? noteEvents.map(ev => `
          <tr>
            <td>${new Date(ev.createdAt).toLocaleString('es-MX')}</td>
            <td>${ev.description}</td>
          </tr>
        `).join('')
      : '';

    const content = `
      <table style="width:100%; margin-bottom:20px;">
        <tr><th style="text-align:left; width:150px; padding:6px 0;">Folio</th><td style="padding:6px 0; font-weight:bold;">${incident.folio}</td></tr>
        <tr><th style="text-align:left; padding:6px 0;">Tipo</th><td style="padding:6px 0;">${typeLabel}</td></tr>
        <tr><th style="text-align:left; padding:6px 0;">Prioridad</th><td style="padding:6px 0;">${priorityLabel}</td></tr>
        <tr><th style="text-align:left; padding:6px 0;">Estado</th><td style="padding:6px 0;">${statusLabel}</td></tr>
        <tr><th style="text-align:left; padding:6px 0;">Creado</th><td style="padding:6px 0;">${new Date(incident.createdAt).toLocaleString('es-MX')}</td></tr>
        ${incident.closedAt ? `<tr><th style="text-align:left; padding:6px 0;">Cerrado</th><td style="padding:6px 0;">${new Date(incident.closedAt).toLocaleString('es-MX')}</td></tr>` : ''}
        ${incident.resolution ? `<tr><th style="text-align:left; padding:6px 0;">Resolucion</th><td style="padding:6px 0;">${incident.resolution}</td></tr>` : ''}
      </table>

      <h2>Ubicacion</h2>
      <p>${incident.address ?? 'Sin direccion registrada'}</p>
      <p style="font-family:monospace; color:#64748B;">${Number(incident.lat).toFixed(6)}, ${Number(incident.lng).toFixed(6)}</p>
      ${incident.description ? `<h2>Descripcion</h2><p>${incident.description}</p>` : ''}

      <h2>Unidades asignadas</h2>
      ${assignments.length > 0
        ? `<table>
            <tr><th>Unidad</th><th>Asignada</th><th>Desasignada</th></tr>
            ${assignmentsHtml}
          </table>`
        : '<p style="color:#94a3b8;">Sin unidades asignadas</p>'}

      <h2>Linea de tiempo (${events.length} eventos)</h2>
      <table>
        <tr><th>Fecha/Hora</th><th>Tipo</th><th>Descripcion</th></tr>
        ${eventsHtml || '<tr><td colspan="3" style="text-align:center; color:#94a3b8;">Sin eventos registrados</td></tr>'}
      </table>

      ${noteEvents.length > 0 ? `
        <h2>Notas (${noteEvents.length})</h2>
        <table>
          <tr><th>Fecha/Hora</th><th>Nota</th></tr>
          ${notesHtml}
        </table>
      ` : ''}

      <h2>Archivos adjuntos</h2>
      <ul>${attachmentsHtml}</ul>
    `;

    exportToPdf(`Reporte de Incidente ${incident.folio}`, content);
  }

  async function handleClose(e: React.FormEvent) {
    e.preventDefault();
    if (resolution.trim().length < 5 || closing) return;
    setClosing(true);
    try {
      const res = await incidentsApi.close(incident.id, resolution.trim());
      updateIncident(res.data);
      setShowCloseForm(false);
    } catch (err) {
      reportError(err, { tag: 'incident.close' });
      if (typeof window !== 'undefined') {
        window.alert('No se pudo cerrar el incidente. Intenta de nuevo.');
      }
    } finally {
      setClosing(false);
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim() || addingNote) return;
    setAddingNote(true);
    try {
      const res = await incidentsApi.addNote(incident.id, noteText.trim());
      setLocalEvents(prev => [...prev, res.data]);
      setNoteText('');
    } catch (err) {
      reportError(err, { tag: 'incident.addNote' });
      if (typeof window !== 'undefined') {
        window.alert('No se pudo agregar la nota. Intenta de nuevo.');
      }
    } finally {
      setAddingNote(false);
    }
  }

  useEffect(() => {
    if (!incident?.id) return;
    attachmentsApi.getByIncident(incident.id)
      .then((res) => setAttachments(res.data))
      .catch((err) => reportError(err, { tag: 'incident.getAttachments' }));
    incidentsApi.getAssignments(incident.id)
      .then((res) => setAssignments(res.data))
      .catch((err) => reportError(err, { tag: 'incident.getAssignments' }));
  }, [incident?.id]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !incident?.id) return;
    setUploading(true);
    try {
      const res = await attachmentsApi.upload(incident.id, file);
      setAttachments((prev) => [...prev, res.data]);
    } catch (err) {
      reportError(err, { tag: 'incident.uploadAttachment' });
      if (typeof window !== 'undefined') {
        window.alert('No se pudo subir el archivo. Verifica el tamaño (máx 10 MB) y formato.');
      }
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
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setShowReplay(true)}
            className="text-xs text-slate-gray hover:text-signal-white transition-colors border border-slate-700 px-2.5 py-1 rounded"
            aria-label="Reproducir incidente"
          >
            ▶ Replay
          </button>
          <button
            onClick={handleExportPdf}
            className="text-xs text-slate-gray hover:text-signal-white transition-colors border border-slate-700 px-2.5 py-1 rounded"
            aria-label="Exportar PDF"
          >
            Exportar PDF
          </button>
        </div>
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
          {Number(incident.lat).toFixed(6)}, {Number(incident.lng).toFixed(6)}
        </div>

        {/* Actions */}
        {!isClosed && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              {canAssign && (
                <button
                  onClick={() => hasUnit ? setShowReassignConfirm(true) : setShowAssign(true)}
                  className="flex-1 bg-tactical-blue hover:bg-blue-600 text-white text-sm font-semibold py-2 rounded transition-colors"
                  aria-label={hasUnit ? 'Reasignar unidad' : 'Asignar unidad'}
                >
                  {hasUnit ? 'Reasignar unidad' : 'Asignar unidad'}
                </button>
              )}
              {canClose && !showCloseForm && (
                <button
                  onClick={() => setShowCloseForm(true)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 rounded transition-colors"
                  aria-label="Cerrar incidente"
                >
                  Cerrar incidente
                </button>
              )}
              <button
                onClick={() => setShowReport(true)}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-2 rounded transition-colors"
                aria-label="Llenar reporte"
              >
                Llenar reporte
              </button>
            </div>
            {showReassignConfirm && (
              <div className="flex flex-col gap-2 bg-slate-800 rounded p-3">
                <p className="text-xs text-slate-300">
                  La unidad <span className="font-mono font-bold text-signal-white">{incident.assignedUnitId}</span> ya está asignada. ¿Confirmas la reasignación?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowReassignConfirm(false); setShowAssign(true); }}
                    className="flex-1 bg-tactical-blue hover:bg-blue-600 text-white text-xs font-semibold py-1.5 rounded transition-colors"
                  >
                    Sí, reasignar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReassignConfirm(false)}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            {showCloseForm && (
              <form onSubmit={handleClose} className="flex flex-col gap-2 bg-slate-800 rounded p-3">
                <label className="text-xs text-slate-gray font-semibold uppercase tracking-wider">
                  Resolución
                </label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Describe la resolución del incidente (mín. 5 caracteres)"
                  rows={3}
                  className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-signal-white placeholder-slate-500 focus:outline-none focus:border-tactical-blue resize-none"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={resolution.trim().length < 5 || closing}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-1.5 rounded disabled:opacity-40 transition-colors"
                  >
                    {closing ? 'Cerrando...' : 'Confirmar cierre'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCloseForm(false); setResolution(''); }}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Assigned units */}
        {assignments.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-gray uppercase tracking-wider mb-2">
              Unidades asignadas
            </h3>
            <div className="flex flex-col gap-1">
              {assignments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between bg-slate-800 rounded px-3 py-1.5"
                >
                  <span className="text-sm text-signal-white font-mono">
                    {a.unit?.callSign ?? a.unitId}
                  </span>
                  <span className="text-xs text-slate-gray">
                    {new Date(a.assignedAt).toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {a.unassignedAt && (
                      <span className="ml-2 text-red-400">
                        (desasignada {new Date(a.unassignedAt).toLocaleTimeString('es-MX', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })})
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div>
          <h3 className="text-xs font-semibold text-slate-gray uppercase tracking-wider mb-2">
            Línea de tiempo
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

        {/* Add note */}
        {!isClosed && (
          <form onSubmit={handleAddNote} className="flex gap-2">
            <input
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Agregar nota al incidente…"
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-signal-white placeholder-slate-500 focus:outline-none focus:border-tactical-blue"
            />
            <button
              type="submit"
              disabled={!noteText.trim() || addingNote}
              className="px-3 py-1.5 bg-tactical-blue hover:bg-blue-600 text-white text-xs font-medium rounded disabled:opacity-40 transition-colors"
            >
              {addingNote ? '…' : 'Nota'}
            </button>
          </form>
        )}

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
            <div className="flex flex-wrap gap-2 mt-1">
              {attachments.map((att) => {
                const isImage = att.mimetype.startsWith('image/');
                return (
                  <a
                    key={att.id}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={att.originalName}
                    className="block rounded-lg overflow-hidden border border-white/10 hover:border-tactical-blue/50 transition-colors"
                  >
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={att.url}
                        alt={att.originalName}
                        className="w-20 h-20 object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 flex flex-col items-center justify-center bg-white/5 gap-1">
                        <span className="text-2xl">📄</span>
                        <span className="text-[10px] text-slate-400 px-1 text-center truncate w-full">{att.originalName}</span>
                      </div>
                    )}
                  </a>
                );
              })}
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

      {/* Report fill modal */}
      {showReport && (
        <ReportFillModal
          incidentId={incident.id}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* Incident replay — GPS + events timelapse */}
      {showReplay && (
        <IncidentReplay
          incidentId={incident.id}
          onClose={() => setShowReplay(false)}
        />
      )}
    </div>
  );
}
