import { Source, Layer } from 'react-map-gl/maplibre';
import type { UnitPosition } from '@/lib/types';

interface Props {
  positions: Record<string, UnitPosition>;
}

export default function CoverageLayer({ positions }: Props) {
  const points = Object.values(positions);

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      properties: { weight: 1 },
    })),
  };

  return (
    <Source id="coverage" type="geojson" data={geojson}>
      <Layer
        id="coverage-heat"
        type="heatmap"
        paint={{
          'heatmap-weight': 1,
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(239,68,68,0.4)',
            0.2, 'rgba(249,115,22,0.3)',
            0.4, 'rgba(245,158,11,0.2)',
            0.6, 'rgba(34,197,94,0.2)',
            0.8, 'rgba(34,197,94,0.4)',
            1, 'rgba(34,197,94,0.6)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 10, 15, 40],
          'heatmap-opacity': 0.7,
        }}
      />
    </Source>
  );
}
