import { Source, Layer } from 'react-map-gl/maplibre';
import type { LocationHistoryPoint } from '@/lib/types';

interface UnitTrailProps {
  unitId: string;
  points: LocationHistoryPoint[];
}

type LineStringFeature = {
  type: 'Feature';
  geometry: {
    type: 'LineString';
    coordinates: number[][];
  };
  properties: Record<string, never>;
};

export default function UnitTrail({ unitId, points }: UnitTrailProps) {
  if (points.length < 2) return null;

  const geojson: LineStringFeature = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: points.map((p) => [Number(p.lng), Number(p.lat)]),
    },
    properties: {},
  };

  return (
    <Source id={`trail-${unitId}`} type="geojson" data={geojson}>
      <Layer
        id={`trail-line-${unitId}`}
        type="line"
        paint={{
          'line-color': '#3B82F6',
          'line-width': 3,
          'line-opacity': 0.75,
          'line-dasharray': [2, 1],
        }}
        layout={{ 'line-join': 'round', 'line-cap': 'round' }}
      />
    </Source>
  );
}
