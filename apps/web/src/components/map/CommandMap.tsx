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
import FleetBatteryPanel from './FleetBatteryPanel';
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

const PRIORITY_CONFIG: Record<string, { color: string; glow: string; emoji: string; ring: string }> = {
  critical: { color: '#EF4444', glow: '#EF444460', emoji: '🚨', ring: '#EF444480' },
  high:     { color: '#F97316', glow: '#F9731640', emoji: '⚠️',  ring: '#F9731660' },
  medium:   { color: '#F59E0B', glow: '#F59E0B40', emoji: '📋', ring: '#F59E0B50' },
  low:      { color: '#22C55E', glow: '#22C55E30', emoji: '📝', ring: '#22C55E40' },
};

const TYPE_EMOJI: Record<string, string> = {
  robbery:        '💰',
  assault:        '🥊',
  traffic:        '🚗',
  noise:          '🔊',
  domestic:       '🏠',
  missing_person: '👤',
  other:          '❓',
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

        {/* Coverage gap layer — always mounted to avoid react-map-gl source id errors */}
        <CoverageLayer positions={showCoverage ? positions : {}} />

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
          const cfg = PRIORITY_CONFIG[incident.priority] ?? PRIORITY_CONFIG['medium']!;
          const typeEmoji = TYPE_EMOJI[incident.type] ?? '❗';
          const isSelected = incident.id === selectedId;
          const dimmed = selectedId != null && !isSelected;
          if (dimmed) return null;
          return (
            <Marker
              key={incident.id}
              latitude={incident.lat}
              longitude={incident.lng}
              anchor="bottom"
            >
              <button
                onClick={() => selectIncident(incident.id)}
                aria-label={`Incidente ${incident.folio}`}
                title={`${incident.folio} — ${incident.priority} · ${incident.type}`}
                className="group relative flex flex-col items-center hover:scale-110 transition-transform duration-200 cursor-pointer select-none"
              >
                {/* Critical pulse ring */}
                {incident.priority === 'critical' && (
                  <span
                    className="absolute inset-0 rounded-xl animate-pulse-ring pointer-events-none"
                    style={{ border: `2px solid ${cfg.color}`, borderRadius: '10px' }}
                  />
                )}

                {/* Badge */}
                <span
                  className="flex items-center gap-1 px-2 py-1 rounded-xl border border-white/20 shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${cfg.color}ee, ${cfg.color}aa)`,
                    boxShadow: isSelected
                      ? `0 0 0 3px ${cfg.ring}, 0 4px 14px ${cfg.glow}`
                      : `0 2px 10px ${cfg.glow}`,
                  }}
                >
                  <span className="text-sm leading-none" role="img" aria-hidden>
                    {typeEmoji}
                  </span>
                  <span className="text-white text-[10px] font-bold font-mono leading-none">
                    {incident.folio?.split('-').pop()}
                  </span>
                  <span className="text-[11px] leading-none" role="img" aria-hidden>
                    {cfg.emoji}
                  </span>
                </span>

                {/* Pointer pin */}
                <span
                  className="w-0 h-0"
                  style={{
                    borderLeft: '4px solid transparent',
                    borderRight: '4px solid transparent',
                    borderTop: `6px solid ${cfg.color}`,
                    marginTop: '-1px',
                  }}
                />

                {/* Tooltip */}
                <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-signal-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none border border-white/10 bg-slate-900/80 backdrop-blur-lg shadow-xl z-50">
                  {typeEmoji} {incident.folio} · {incident.priority}
                </span>
              </button>
            </Marker>
          );
        })}
      </Map>

      {/* Fleet battery panel */}
      <FleetBatteryPanel units={units} positions={positions} />

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
