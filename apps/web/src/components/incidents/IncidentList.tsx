'use client';

import { useState } from 'react';
import { useIncidentsStore } from '@/store/incidents.store';
import { useAuthStore } from '@/store/auth.store';
import { permissions } from '@/lib/permissions';
import IncidentCard from './IncidentCard';
import CreateIncidentModal from './CreateIncidentModal';
import Spinner from '@/components/ui/Spinner';
import { SkeletonList } from '@/components/ui/Skeleton';
import type { Sector } from '@/lib/types';

const STATUS_OPTIONS = [
  { value: null, label: 'Todos' },
  { value: 'open', label: 'Abiertos' },
  { value: 'assigned', label: 'Asignados' },
  { value: 'on_scene', label: 'En Escena' },
  { value: 'closed', label: 'Cerrados' },
];

interface IncidentListProps {
  sectors?: Sector[];
  crisisMode?: boolean;
}

export default function IncidentList({ sectors = [], crisisMode = false }: IncidentListProps) {
  const { incidents, selectedId, selectIncident, filters, setFilters, isLoading } = useIncidentsStore();
  const user = useAuthStore((s) => s.user);
  const canCreate = permissions.createIncident(user?.role as never);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = incidents.filter((inc) => {
    if (filters.status && inc.status !== filters.status) return false;
    if (filters.sectorId && inc.sectorId !== filters.sectorId) return false;
    if (crisisMode && inc.priority !== 'critical' && inc.priority !== 'high') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchesFolio = inc.folio?.toLowerCase().includes(q);
      const matchesAddress = inc.address?.toLowerCase().includes(q);
      const matchesType = inc.type?.toLowerCase().includes(q);
      if (!matchesFolio && !matchesAddress && !matchesType) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <h2 className="text-sm font-semibold text-signal-white">Incidentes</h2>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="text-xs bg-tactical-blue hover:bg-blue-600 text-white px-3 py-1 rounded transition-colors"
          >
            + Nuevo
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-slate-800 shrink-0">
        <input
          type="text"
          placeholder="Buscar folio, dirección..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 text-signal-white text-xs rounded px-3 py-1.5 focus:outline-none focus:border-tactical-blue placeholder-slate-500"
        />
      </div>

      {/* Status filter chips */}
      <div className="flex gap-1 px-3 py-2 border-b border-slate-800 overflow-x-auto shrink-0">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => setFilters({ status: opt.value })}
            className={`text-xs px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
              filters.status === opt.value
                ? 'bg-tactical-blue text-white'
                : 'bg-slate-800 text-slate-gray hover:text-signal-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Sector filter */}
      {sectors.length > 0 && (
        <div className="px-3 py-2 border-b border-slate-800 shrink-0">
          <select
            value={filters.sectorId ?? ''}
            onChange={(e) => setFilters({ sectorId: e.target.value || null })}
            className="w-full bg-slate-800 border border-slate-700 text-signal-white text-xs rounded px-2 py-1 focus:outline-none focus:border-tactical-blue"
            aria-label="Filtrar por sector"
          >
            <option value="">Todos los sectores</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="px-2 py-2">
            <SkeletonList count={5} />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-gray text-sm py-12">
            Sin incidentes
          </p>
        ) : (
          filtered.map((incident) => (
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
