'use client';
import { useRef, useEffect, useCallback, useState } from 'react';
import Map, { Source, Layer, type MapRef } from 'react-map-gl/maplibre';
import type { SectorWithBoundary } from '@/lib/types';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface Props {
  sectors: SectorWithBoundary[];
  selectedSectorId: string | null;
  onBoundaryDrawn: (sectorId: string, coordinates: [number, number][]) => void;
}

function buildPreview(
  points: [number, number][],
  hover: [number, number] | null,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  if (points.length === 0) return { type: 'FeatureCollection', features };

  // Vertex points
  features.push({
    type: 'Feature',
    geometry: { type: 'MultiPoint', coordinates: points },
    properties: { role: 'vertex' },
  });

  // First point highlight (close target)
  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: points[0]! },
    properties: { role: 'first' },
  });

  // Line + cursor preview
  const line = hover ? [...points, hover] : points;
  if (line.length >= 2) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: line },
      properties: { role: 'line' },
    });
  }

  // Polygon fill when >= 3 points
  if (points.length >= 3) {
    const ring: [number, number][] = hover
      ? [...points, hover, points[0]!]
      : [...points, points[0]!];
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: { role: 'fill' },
    });
  }

  return { type: 'FeatureCollection', features };
}

export default function SectorDrawMap({ sectors, selectedSectorId, onBoundaryDrawn }: Props) {
  const mapRef = useRef<MapRef>(null);
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [hover, setHover] = useState<[number, number] | null>(null);

  // Exit draw mode when sector changes
  useEffect(() => {
    setDrawing(false);
    setPoints([]);
    setHover(null);
  }, [selectedSectorId]);

  // Update cursor
  useEffect(() => {
    const canvas = mapRef.current?.getMap()?.getCanvas();
    if (canvas) canvas.style.cursor = drawing ? 'crosshair' : '';
  }, [drawing]);

  const handleClick = useCallback((e: MapLayerMouseEvent) => {
    if (!drawing) return;
    const { lng, lat } = e.lngLat;
    const newPoint: [number, number] = [lng, lat];

    setPoints(prev => {
      // Close polygon if clicking near first point (within ~20px equivalent)
      if (prev.length >= 3) {
        const first = prev[0]!;
        const dx = first[0] - lng;
        const dy = first[1] - lat;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.001) {
          // Will close in handleSave
          return prev;
        }
      }
      return [...prev, newPoint];
    });
  }, [drawing]);

  const handleDblClick = useCallback((e: MapLayerMouseEvent) => {
    e.preventDefault();
    if (!drawing) return;
    setPoints(prev => {
      if (prev.length >= 3 && selectedSectorId) {
        const closed: [number, number][] = [...prev, prev[0]!];
        onBoundaryDrawn(selectedSectorId, closed);
        setDrawing(false);
        setHover(null);
        return [];
      }
      return prev;
    });
  }, [drawing, selectedSectorId, onBoundaryDrawn]);

  const handleMouseMove = useCallback((e: MapLayerMouseEvent) => {
    if (!drawing) return;
    setHover([e.lngLat.lng, e.lngLat.lat]);
  }, [drawing]);

  function handleSave() {
    if (points.length < 3 || !selectedSectorId) return;
    const closed: [number, number][] = [...points, points[0]!];
    onBoundaryDrawn(selectedSectorId, closed);
    setDrawing(false);
    setPoints([]);
    setHover(null);
  }

  function startDrawing() {
    setPoints([]);
    setHover(null);
    setDrawing(true);
  }

  function cancelDrawing() {
    setDrawing(false);
    setPoints([]);
    setHover(null);
  }

  // GeoJSON for the selected sector's existing boundary
  const selectedSector = sectors.find(s => s.id === selectedSectorId);
  const existingBoundary: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: selectedSector?.boundaryGeoJson && !drawing
      ? [{ type: 'Feature', geometry: selectedSector.boundaryGeoJson, properties: {} }]
      : [],
  };

  // GeoJSON for all OTHER sectors
  const otherSectors: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: sectors
      .filter(s => s.boundaryGeoJson && s.id !== selectedSectorId)
      .map(s => ({
        type: 'Feature' as const,
        geometry: s.boundaryGeoJson!,
        properties: { color: s.color },
      })),
  };

  const preview = buildPreview(points, hover);

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: -99.1332, latitude: 19.4326, zoom: 12 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
        onClick={handleClick}
        onDblClick={handleDblClick}
        onMouseMove={handleMouseMove}
        doubleClickZoom={false}
      >
        {/* Other sectors reference */}
        <Source id="other" type="geojson" data={otherSectors}>
          <Layer id="other-fill" type="fill"
            paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': 0.1 }} />
          <Layer id="other-line" type="line"
            paint={{ 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.5 }} />
        </Source>

        {/* Existing boundary of selected sector */}
        <Source id="existing" type="geojson" data={existingBoundary}>
          <Layer id="existing-fill" type="fill"
            paint={{ 'fill-color': selectedSector?.color ?? '#3B82F6', 'fill-opacity': 0.2 }} />
          <Layer id="existing-line" type="line"
            paint={{ 'line-color': selectedSector?.color ?? '#3B82F6', 'line-width': 2 }} />
        </Source>

        {/* Drawing preview — always mounted, empty when not drawing */}
        <Source id="preview" type="geojson" data={drawing ? preview : { type: 'FeatureCollection', features: [] }}>
          <Layer id="preview-fill" type="fill"
            filter={['==', ['get', 'role'], 'fill']}
            paint={{ 'fill-color': '#F59E0B', 'fill-opacity': 0.2 }} />
          <Layer id="preview-line" type="line"
            filter={['==', ['get', 'role'], 'line']}
            paint={{ 'line-color': '#F59E0B', 'line-width': 2, 'line-dasharray': [3, 2] }} />
          <Layer id="preview-vertex" type="circle"
            filter={['==', ['get', 'role'], 'vertex']}
            paint={{ 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#F59E0B' }} />
          <Layer id="preview-first" type="circle"
            filter={['==', ['get', 'role'], 'first']}
            paint={{ 'circle-radius': 8, 'circle-color': '#10B981', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' }} />
        </Source>
      </Map>

      {/* Controls overlay */}
      {selectedSectorId && (
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          {!drawing ? (
            <button
              onClick={startDrawing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-lg transition-colors"
            >
              {selectedSector?.boundaryGeoJson ? 'Redibujar geocerca' : 'Dibujar geocerca'}
            </button>
          ) : (
            <>
              <div className="bg-gray-900/90 text-white text-xs px-3 py-2 rounded-lg shadow-lg backdrop-blur">
                <p className="font-medium mb-0.5">
                  {points.length === 0 && 'Clic para colocar el primer punto'}
                  {points.length === 1 && 'Clic para agregar más puntos'}
                  {points.length === 2 && 'Agrega al menos un punto más'}
                  {points.length >= 3 && `${points.length} puntos — doble clic o guardar`}
                </p>
                <p className="text-gray-400">
                  Doble clic para cerrar el polígono
                </p>
              </div>
              <button
                onClick={handleSave}
                disabled={points.length < 3}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg shadow-lg transition-colors"
              >
                Guardar ({points.length} pts)
              </button>
              <button
                onClick={() => setPoints(p => p.slice(0, -1))}
                disabled={points.length === 0}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg shadow-lg transition-colors"
              >
                Deshacer último
              </button>
              <button
                onClick={cancelDrawing}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg shadow-lg transition-colors"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
