// apps/web/src/components/map/CommandMap.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useUnitsStore } from '@/store/units.store';
import { useIncidentsStore } from '@/store/incidents.store';
import { sectorsApi } from '@/lib/api';
import UnitMarker from './UnitMarker';
import UnitTrail from './UnitTrail';
import SectorLayer from './SectorLayer';
import HeatmapLayer from './HeatmapLayer';
import CoverageLayer from './CoverageLayer';
import type { LocationHistoryPoint, SectorWithBoundary, HeatmapPoint } from '@/lib/types';

const MAP_STYLES: Record<string, { label: string; url: string }> = {
  dark: {
    label: 'Oscuro',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  },
  street: {
    label: 'Calles',
    url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  },
  positron: {
    label: 'Claro',
    url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  },
};
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
  showCoverage?: boolean;
}

export default function CommandMap({
  trailPoints = [],
  sectors = [],
  drawSectorId,
  onBoundarySet,
  heatmapPoints,
  showCoverage,
}: CommandMapProps) {
  const { units, positions, trails, trailStarts, selectedUnitId, selectUnit } = useUnitsStore();
  const { incidents, selectedId, selectIncident } = useIncidentsStore();

  const [mapStyle, setMapStyle] = useState('dark');

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
  const focusedIncident = selectedId ? incidents.find((i) => i.id === selectedId) : null;

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
        mapStyle={MAP_STYLES[mapStyle]?.url ?? MAP_STYLES['dark']!.url}
        cursor={drawMode ? 'crosshair' : 'auto'}
        onClick={handleMapClick}
      >
        {/* Sector boundaries */}
        <SectorLayer sectors={sectors} />

        {/* Incident density heatmap */}
        <HeatmapLayer points={heatmapPoints ?? []} />

        {/* Coverage gap layer */}
        {showCoverage && <CoverageLayer positions={positions} />}

        {/* Unit trail polyline — historical, from API */}
        <UnitTrail unitId={selectedUnitId ?? ''} points={selectedUnitId ? trailPoints : []} />

        {/* Live trails — realtime breadcrumbs for all units */}
        <Source
          id="live-trails"
          type="geojson"
          data={{
            type: 'FeatureCollection',
            features: Object.entries(trails)
              .filter(([, pts]) => pts.length >= 2)
              .map(([unitId, pts]) => ({
                type: 'Feature' as const,
                geometry: { type: 'LineString' as const, coordinates: pts },
                properties: { unitId },
              })),
          }}
        >
          <Layer
            id="live-trails-line"
            type="line"
            paint={{
              'line-color': '#3B82F6',
              'line-width': 2.5,
              'line-opacity': 0.6,
            }}
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
          />
        </Source>

        {/* Trail start pins — where each unit began tracking */}
        {Object.entries(trailStarts).map(([unitId, [lng, lat]]) => {
          const unit = units.find((u) => u.id === unitId);
          if (!unit) return null;
          return (
            <Marker key={`start-${unitId}`} latitude={lat} longitude={lng} anchor="bottom">
              <div
                className="flex flex-col items-center pointer-events-none"
                title={`Inicio: ${unit.callSign}`}
              >
                <div className="bg-green-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-md border border-white/80">
                  INICIO
                </div>
                <div className="w-0.5 h-2 bg-green-500/60" />
                <div className="w-2 h-2 rounded-full bg-green-500 border border-white shadow" />
              </div>
            </Marker>
          );
        })}

        {/* Unit markers — dim non-related units when incident is focused */}
        {units.map((unit) => {
          const pos = positions[unit.id];
          if (!pos) return null;
          const dimUnit = focusedIncident != null && unit.id !== focusedIncident.assignedUnitId;
          return (
            <Marker key={unit.id} latitude={pos.lat} longitude={pos.lng}>
              <div style={{ opacity: dimUnit ? 0.25 : 1, transition: 'opacity 200ms' }}>
                <UnitMarker
                  callSign={unit.callSign}
                  status={unit.status}
                  batteryLevel={pos.batteryLevel}
                  onClick={() => selectUnit(unit.id === selectedUnitId ? null : unit.id)}
                />
              </div>
            </Marker>
          );
        })}

        {/* Incident markers — when one is selected, dim others */}
        {activeIncidents.map((incident) => {
          const color = PRIORITY_COLORS[incident.priority] ?? '#F59E0B';
          const isSelected = incident.id === selectedId;
          const dimmed = selectedId != null && !isSelected;
          if (dimmed) return null; // hide non-selected incidents when one is focused
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

      {/* Map style selector */}
      <div className="absolute bottom-4 left-4 z-10 flex gap-1 bg-slate-900/90 rounded-lg p-1 backdrop-blur">
        {Object.entries(MAP_STYLES).map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => setMapStyle(key)}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              mapStyle === key
                ? 'bg-tactical-blue text-white'
                : 'text-slate-gray hover:text-signal-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
