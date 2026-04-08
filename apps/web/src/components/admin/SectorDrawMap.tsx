'use client';
import { useRef, useEffect, useCallback } from 'react';
import Map, { Source, Layer, type MapRef } from 'react-map-gl/maplibre';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import type { SectorWithBoundary } from '@/lib/types';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface Props {
  sectors: SectorWithBoundary[];
  selectedSectorId: string | null;
  onBoundaryDrawn: (sectorId: string, coordinates: [number, number][]) => void;
}

export default function SectorDrawMap({ sectors, selectedSectorId, onBoundaryDrawn }: Props) {
  const mapRef = useRef<MapRef>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const selectedIdRef = useRef(selectedSectorId);

  // Keep ref in sync so the draw.create handler always sees the latest value
  useEffect(() => {
    selectedIdRef.current = selectedSectorId;
  }, [selectedSectorId]);

  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || drawRef.current) return;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: 'simple_select',
      styles: [
        {
          id: 'gl-draw-polygon-fill-inactive',
          type: 'fill',
          filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
          paint: { 'fill-color': '#3B82F6', 'fill-opacity': 0.2 },
        },
        {
          id: 'gl-draw-polygon-fill-active',
          type: 'fill',
          filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
          paint: { 'fill-color': '#F59E0B', 'fill-opacity': 0.25 },
        },
        {
          id: 'gl-draw-polygon-stroke-inactive',
          type: 'line',
          filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
          paint: { 'line-color': '#3B82F6', 'line-width': 2 },
        },
        {
          id: 'gl-draw-polygon-stroke-active',
          type: 'line',
          filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
          paint: { 'line-color': '#F59E0B', 'line-width': 2, 'line-dasharray': [4, 2] },
        },
        {
          id: 'gl-draw-polygon-midpoint',
          type: 'circle',
          filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
          paint: { 'circle-radius': 4, 'circle-color': '#F59E0B' },
        },
        {
          id: 'gl-draw-polygon-vertex',
          type: 'circle',
          filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
          paint: { 'circle-radius': 6, 'circle-color': '#3B82F6', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' },
        },
      ],
    });

    // MapboxDraw expects a mapbox-gl-like map; cast for compatibility with maplibre
    map.addControl(draw as unknown as maplibregl.IControl);
    drawRef.current = draw;

    map.on('draw.create', (e: { features: GeoJSON.Feature[] }) => {
      const currentSectorId = selectedIdRef.current;
      if (!currentSectorId) return;
      const feature = e.features[0];
      if (feature?.geometry?.type === 'Polygon') {
        const coords = (feature.geometry as GeoJSON.Polygon).coordinates[0] as [number, number][];
        onBoundaryDrawn(currentSectorId, coords);
        draw.deleteAll();
      }
    });
  }, [onBoundaryDrawn]);

  // When selected sector changes, load its existing boundary into draw tool
  useEffect(() => {
    const draw = drawRef.current;
    if (!draw) return;
    draw.deleteAll();

    if (selectedSectorId) {
      const sector = sectors.find(s => s.id === selectedSectorId);
      if (sector?.boundaryGeoJson) {
        draw.add({
          type: 'Feature',
          geometry: sector.boundaryGeoJson,
          properties: {},
        });
      }
    }
  }, [selectedSectorId, sectors]);

  // GeoJSON for all OTHER sectors (render as reference)
  const otherSectorsGeoJson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: sectors
      .filter(s => s.boundaryGeoJson && s.id !== selectedSectorId)
      .map(s => ({
        type: 'Feature' as const,
        geometry: s.boundaryGeoJson!,
        properties: { id: s.id, name: s.name, color: s.color },
      })),
  };

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: -99.1332, latitude: 19.4326, zoom: 12 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLE}
      onLoad={onMapLoad}
    >
      {otherSectorsGeoJson.features.length > 0 && (
        <Source id="other-sectors" type="geojson" data={otherSectorsGeoJson}>
          <Layer
            id="other-sector-fill"
            type="fill"
            paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': 0.12 }}
          />
          <Layer
            id="other-sector-line"
            type="line"
            paint={{ 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.6 }}
          />
        </Source>
      )}
    </Map>
  );
}
