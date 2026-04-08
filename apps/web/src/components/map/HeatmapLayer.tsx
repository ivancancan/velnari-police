// apps/web/src/components/map/HeatmapLayer.tsx
import { Source, Layer } from 'react-map-gl/maplibre';
import type { HeatmapPoint } from '@/lib/types';

type GeoJsonFeatureCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { weight: number };
  }>;
};

interface HeatmapLayerProps {
  points: HeatmapPoint[];
}

export default function HeatmapLayer({ points }: HeatmapLayerProps) {
  if (points.length === 0) return null;

  const geojson: GeoJsonFeatureCollection = {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      properties: { weight: p.weight },
    })),
  };

  return (
    <Source id="heatmap" type="geojson" data={geojson}>
      <Layer
        id="heatmap-layer"
        type="heatmap"
        paint={{
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 1, 0.25, 4, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,255,0)',
            0.2, 'rgb(0,153,255)',
            0.4, 'rgb(0,255,153)',
            0.6, 'rgb(255,255,0)',
            0.8, 'rgb(255,128,0)',
            1, 'rgb(239,68,68)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 15, 20],
          'heatmap-opacity': 0.75,
        }}
      />
    </Source>
  );
}
