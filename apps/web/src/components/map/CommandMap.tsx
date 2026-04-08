// apps/web/src/components/map/CommandMap.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useUnitsStore } from '@/store/units.store';
import { useIncidentsStore } from '@/store/incidents.store';
import { sectorsApi } from '@/lib/api';
import UnitMarker from './UnitMarker';
import UnitTrail from './UnitTrail';
import SectorLayer from './SectorLayer';
import HeatmapLayer from './HeatmapLayer';
import type { LocationHistoryPoint, SectorWithBoundary, HeatmapPoint } from '@/lib/types';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const DEFAULT_VIEW = { latitude: 19.4326, longitude: -99.1332, zoom: 12 };

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#22C55E',
};

export interface CommandMapProps {
  trailPoints?: LocationHistoryPoint[];
  sectors?: SectorWithBoundary[];
  drawSectorId?: string | null;
  onBoundarySet?: () => void;
  heatmapPoints?: HeatmapPoint[];
}

export default function CommandMap({
  trailPoints = [],
  sectors = [],
  drawSectorId,
  onBoundarySet,
  heatmapPoints,
}: CommandMapProps) {
  const { units, positions, selectedUnitId, selectUnit } = useUnitsStore();
  const { incidents, selectedId, selectIncident } = useIncidentsStore();

  const [drawMode, setDrawMode] = useState<{
    sectorId: string;
    sectorName: string;
    firstClick: [number, number] | null;
  } | null>(null);

  // Enter draw mode when drawSectorId changes
  useEffect(() => {
    if (!drawSectorId) return;
    const sector = sectors.find((s) => s.id === drawSectorId);
    if (sector) {
      setDrawMode({ sectorId: drawSectorId, sectorName: sector.name, firstClick: null });
    }
  }, [drawSectorId, sectors]);

  const activeIncidents = incidents.filter((i) => i.status !== 'closed');

  const handleMapClick = useCallback(
    async (e: MapLayerMouseEvent) => {
      if (!drawMode) return;
      const { lng, lat } = e.lngLat;

      if (!drawMode.firstClick) {
        setDrawMode((prev) => prev && { ...prev, firstClick: [lng, lat] });
        return;
      }

      // Second click — build closed rectangle polygon from two corner points
      const [lng1, lat1] = drawMode.firstClick;
      const [lng2, lat2] = [lng, lat];
      const minLng = Math.min(lng1, lng2);
      const maxLng = Math.max(lng1, lng2);
      const minLat = Math.min(lat1, lat2);
      const maxLat = Math.max(lat1, lat2);

      const coordinates: [number, number][] = [
        [minLng, maxLat], // NW
        [maxLng, maxLat], // NE
        [maxLng, minLat], // SE
        [minLng, minLat], // SW
        [minLng, maxLat], // close
      ];

      try {
        await sectorsApi.setBoundary(drawMode.sectorId, coordinates);
        setDrawMode(null);
        onBoundarySet?.();
      } catch {
        setDrawMode(null);
      }
    },
    [drawMode, onBoundarySet],
  );

  return (
    <div className="relative w-full h-full">
      {/* Draw mode indicator */}
      {drawMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-alert-amber text-midnight-command text-xs font-bold px-4 py-2 rounded-full shadow-lg pointer-events-none">
          {drawMode.firstClick
            ? `2° clic → esquina SE de "${drawMode.sectorName}"`
            : `1° clic → esquina NW de "${drawMode.sectorName}"`}
        </div>
      )}

      {/* Cancel draw mode */}
      {drawMode && (
        <button
          onClick={() => setDrawMode(null)}
          className="absolute top-14 left-1/2 -translate-x-1/2 z-10 bg-slate-800 hover:bg-slate-700 text-signal-white text-xs px-3 py-1 rounded shadow"
        >
          Cancelar
        </button>
      )}

      <Map
        initialViewState={DEFAULT_VIEW}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
        cursor={drawMode ? 'crosshair' : 'auto'}
        onClick={handleMapClick}
      >
        {/* Sector boundaries */}
        <SectorLayer sectors={sectors} />

        {/* Incident density heatmap */}
        {heatmapPoints && heatmapPoints.length > 0 && (
          <HeatmapLayer points={heatmapPoints} />
        )}

        {/* Unit trail polyline */}
        {selectedUnitId && trailPoints.length > 0 && (
          <UnitTrail unitId={selectedUnitId} points={trailPoints} />
        )}

        {/* Unit markers */}
        {units.map((unit) => {
          const pos = positions[unit.id];
          if (!pos) return null;
          return (
            <Marker key={unit.id} latitude={pos.lat} longitude={pos.lng}>
              <UnitMarker
                callSign={unit.callSign}
                status={unit.status}
                onClick={() => selectUnit(unit.id === selectedUnitId ? null : unit.id)}
              />
            </Marker>
          );
        })}

        {/* Incident markers */}
        {activeIncidents.map((incident) => {
          const color = PRIORITY_COLORS[incident.priority] ?? '#F59E0B';
          const isSelected = incident.id === selectedId;
          return (
            <Marker
              key={incident.id}
              latitude={incident.lat}
              longitude={incident.lng}
            >
              <button
                onClick={() => selectIncident(incident.id)}
                aria-label={`Incidente ${incident.folio}`}
                title={`${incident.folio} — ${incident.priority}`}
                className="flex items-center justify-center w-7 h-7 rounded-full border-2 border-white shadow-lg hover:scale-110 transition-transform"
                style={{
                  backgroundColor: color,
                  boxShadow: isSelected ? `0 0 0 3px ${color}60` : undefined,
                }}
              >
                <span className="text-white text-[10px] font-bold">!</span>
              </button>
            </Marker>
          );
        })}
      </Map>
    </div>
  );
}
