'use client';

import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import HeatmapLayer from '../map/HeatmapLayer';
import type { HeatmapPoint } from '@/lib/types';

const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const DEFAULT_LAT = 21.87;
const DEFAULT_LNG = -102.30;

interface Props {
  points: HeatmapPoint[];
}

function computeCenter(points: HeatmapPoint[]): { latitude: number; longitude: number } {
  if (points.length === 0) return { latitude: DEFAULT_LAT, longitude: DEFAULT_LNG };
  const sumLat = points.reduce((acc, p) => acc + p.lat, 0);
  const sumLng = points.reduce((acc, p) => acc + p.lng, 0);
  return { latitude: sumLat / points.length, longitude: sumLng / points.length };
}

export default function InsightsHeatmap({ points }: Props) {
  const center = computeCenter(points);

  return (
    <div className="relative w-full h-full">
      {/* Point count badge */}
      {points.length > 0 && (
        <div className="absolute top-3 right-3 z-10 bg-slate-900/80 border border-slate-700 rounded-lg px-2.5 py-1 backdrop-blur-sm">
          <span className="text-[11px] font-mono text-slate-300">
            {points.length} pts
          </span>
        </div>
      )}
      <Map
        mapStyle={DARK_STYLE}
        initialViewState={{
          latitude: center.latitude,
          longitude: center.longitude,
          zoom: 11,
        }}
        style={{ width: '100%', height: '100%' }}
        interactive={true}
      >
        {points.length > 0 && <HeatmapLayer points={points} />}
      </Map>
    </div>
  );
}
