'use client';

import Map, { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useUnitsStore } from '@/store/units.store';
import { useIncidentsStore } from '@/store/incidents.store';
import UnitMarker from './UnitMarker';

// CARTO Voyager: free, no API key, Google Maps-like street style
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

// Mexico City center as default view
const DEFAULT_VIEW = { latitude: 19.4326, longitude: -99.1332, zoom: 12 };

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#22C55E',
};

export default function CommandMap() {
  const { units, positions } = useUnitsStore();
  const { incidents, selectedId, selectIncident } = useIncidentsStore();

  const activeIncidents = incidents.filter(
    (i) => i.status !== 'closed',
  );

  return (
    <Map
      initialViewState={DEFAULT_VIEW}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLE}
    >
      {/* Unit markers — only for units that have a known position */}
      {units.map((unit) => {
        const pos = positions[unit.id];
        if (!pos) return null;
        return (
          <Marker key={unit.id} latitude={pos.lat} longitude={pos.lng}>
            <UnitMarker callSign={unit.callSign} status={unit.status} />
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
  );
}
