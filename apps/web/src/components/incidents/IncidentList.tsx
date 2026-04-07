'use client';

import { useState } from 'react';
import { useIncidentsStore } from '@/store/incidents.store';
import IncidentCard from './IncidentCard';
import CreateIncidentModal from './CreateIncidentModal';

export default function IncidentList() {
  const { incidents, selectedId, selectIncident } = useIncidentsStore();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <h2 className="text-sm font-semibold text-signal-white">Incidentes</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="text-xs bg-tactical-blue hover:bg-blue-600 text-white px-3 py-1 rounded transition-colors"
        >
          + Nuevo
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {incidents.length === 0 ? (
          <p className="text-center text-slate-gray text-sm py-12">
            Sin incidentes activos
          </p>
        ) : (
          incidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              isSelected={incident.id === selectedId}
              onClick={() => selectIncident(incident.id)}
            />
          ))
        )}
      </div>

      {showCreate && (
        <CreateIncidentModal onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
