'use client';

import { useMemo } from 'react';
import Map, { Source, Layer } from 'react-map-gl/maplibre';
import type { HeatmapLayer as HeatmapLayerType } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

// Public-facing map for the transparency portal. No auth; coordinates
// already server-side rounded to ~100m. Renders a heatmap rather than
// individual markers so no reporter can be pinpointed visually.

interface Point {
  lat: number;
  lng: number;
  priority: string;
}

interface Props {
  points: Point[];
}

const HEATMAP_LAYER: Omit<HeatmapLayerType, 'source'> = {
  id: 'transparency-heatmap',
  type: 'heatmap',
  maxzoom: 15,
  paint: {
    'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 1, 1],
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
    'heatmap-color': [
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0, 'rgba(33,102,172,0)',
      0.2, 'rgb(103,169,207)',
      0.4, 'rgb(209,229,240)',
      0.6, 'rgb(253,219,199)',
      0.8, 'rgb(239,138,98)',
      1, 'rgb(178,24,43)',
    ],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 15, 30],
    'heatmap-opacity': 0.65,
  },
};

const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 1,
  high: 0.75,
  medium: 0.5,
  low: 0.25,
};

export default function TransparencyMap({ points }: Props) {
  const features = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: points.map((p) => ({
        type: 'Feature' as const,
        properties: { weight: PRIORITY_WEIGHT[p.priority] ?? 0.5 },
        geometry: {
          type: 'Point' as const,
          coordinates: [p.lng, p.lat],
        },
      })),
    }),
    [points],
  );

  const center =
    points.length > 0
      ? {
          longitude: points.reduce((s, p) => s + p.lng, 0) / points.length,
          latitude: points.reduce((s, p) => s + p.lat, 0) / points.length,
        }
      : { longitude: -103.3496, latitude: 20.6597 }; // Guadalajara centro

  return (
    <div className="w-full h-80 md:h-[420px] rounded-xl overflow-hidden border border-slate-800">
      <Map
        initialViewState={{ ...center, zoom: 11 }}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        attributionControl
      >
        <Source id="transparency-points" type="geojson" data={features}>
          <Layer {...HEATMAP_LAYER} />
        </Source>
      </Map>
    </div>
  );
}
