// apps/web/src/components/map/SectorLayer.tsx
import { Source, Layer } from 'react-map-gl/maplibre';
import type { SectorWithBoundary } from '@/lib/types';

type FeatureCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'Polygon'; coordinates: [number, number][][] };
    properties: Record<string, unknown>;
  }>;
};

interface SectorLayerProps {
  sectors: SectorWithBoundary[];
}

export default function SectorLayer({ sectors }: SectorLayerProps) {
  const validSectors = sectors.filter((s) => s.boundaryGeoJson !== null);
  if (validSectors.length === 0) return null;

  const geojson: FeatureCollection = {
    type: 'FeatureCollection',
    features: validSectors.map((s) => ({
      type: 'Feature' as const,
      geometry: s.boundaryGeoJson!,
      properties: { id: s.id, name: s.name, color: s.color },
    })),
  };

  return (
    <Source id="sectors" type="geojson" data={geojson}>
      {/* Fill layer */}
      <Layer
        id="sectors-fill"
        type="fill"
        paint={{
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.08,
        }}
      />
      {/* Outline layer */}
      <Layer
        id="sectors-outline"
        type="line"
        paint={{
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-opacity': 0.6,
          'line-dasharray': [4, 2],
        }}
      />
      {/* Label layer */}
      <Layer
        id="sectors-label"
        type="symbol"
        layout={{
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': 12,
          'text-anchor': 'center',
        }}
        paint={{
          'text-color': ['get', 'color'],
          'text-halo-color': '#0F172A',
          'text-halo-width': 2,
        }}
      />
    </Source>
  );
}
