'use client';
import { useCallback } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface Props {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}

export default function LocationPickerMap({ lat, lng, onPick }: Props) {
  const handleClick = useCallback((e: MapLayerMouseEvent) => {
    onPick(e.lngLat.lat, e.lngLat.lng);
  }, [onPick]);

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden">
      <Map
        initialViewState={{ longitude: -99.1332, latitude: 19.4326, zoom: 11 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
        onClick={handleClick}
        cursor="crosshair"
      >
        {lat !== null && lng !== null && (
          <Marker latitude={lat} longitude={lng} anchor="bottom">
            <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
              <path
                d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20S24 21 24 12C24 5.373 18.627 0 12 0z"
                fill="#EF4444"
                stroke="#fff"
                strokeWidth="1.5"
              />
              <circle cx="12" cy="12" r="4" fill="#fff" />
            </svg>
          </Marker>
        )}
      </Map>
      {lat === null && (
        <div className="absolute inset-0 flex items-end justify-center pb-3 pointer-events-none">
          <div className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur">
            Haz clic para marcar la ubicación
          </div>
        </div>
      )}
    </div>
  );
}
