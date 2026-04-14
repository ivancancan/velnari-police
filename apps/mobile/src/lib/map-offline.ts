// apps/mobile/src/lib/map-offline.ts
//
// Downloads and manages an offline MapLibre tile pack for the active
// municipality so officers have full map coverage with zero mobile data.
//
// Called once on first map load (or on shift start). Checks if the pack
// already exists before downloading — safe to call repeatedly.
//
// Bounding boxes are in GeoJSON order: [longitude, latitude].
// To get the bounds for a new municipality, open maps.google.com, zoom to
// the metro area, and read the lat/lng from the URL.
//
// TODO: drive MUNICIPALITY_BOUNDS from tenant config (API) so each customer
//       automatically gets the right region pre-downloaded.

import MapLibreGL from '@maplibre/maplibre-react-native';

export const MAP_STYLES = {
  dark: {
    label: 'Nocturno',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  },
  streets: {
    label: 'Calles',
    url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  },
  light: {
    label: 'Claro',
    url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  },
} as const;

export type MapStyleKey = keyof typeof MAP_STYLES;
export const DEFAULT_MAP_STYLE: MapStyleKey = 'dark';

// Guadalajara metro area — covers the full ZMG at useful patrol zoom levels.
// Zoom 11–16: street-level detail without downloading the entire country.
// ~25–40 MB download, stored permanently on the device.
const MUNICIPALITY_BOUNDS: [[number, number], [number, number]] = [
  [-103.48, 20.52], // SW corner [lng, lat]
  [-103.18, 20.78], // NE corner [lng, lat]
];
const PACK_NAME = 'velnari-municipio-v1';
const MIN_ZOOM = 11;
const MAX_ZOOM = 16;

export interface OfflinePackStatus {
  state: 'idle' | 'downloading' | 'complete' | 'error';
  progress: number; // 0–100
}

/**
 * Ensures the offline tile pack exists. Downloads it if missing.
 * Pass an onProgress callback to show download UI.
 * Safe to call multiple times — no-ops if pack is already downloaded.
 */
export async function ensureOfflinePack(
  styleKey: MapStyleKey = DEFAULT_MAP_STYLE,
  onProgress?: (status: OfflinePackStatus) => void,
): Promise<void> {
  try {
    const packs = await MapLibreGL.offlineManager.getPacks();
    const existing = packs.find((p) => p.name === PACK_NAME);

    if (existing) {
      onProgress?.({ state: 'complete', progress: 100 });
      return;
    }

    onProgress?.({ state: 'downloading', progress: 0 });

    await MapLibreGL.offlineManager.createPack(
      {
        name: PACK_NAME,
        styleURL: MAP_STYLES[styleKey].url,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        bounds: MUNICIPALITY_BOUNDS,
      },
      (_region, status) => {
        const pct = status.percentage ?? 0;
        if (status.state === MapLibreGL.OfflinePackDownloadState.Active) {
          onProgress?.({ state: 'downloading', progress: Math.round(pct) });
        } else if (status.state === MapLibreGL.OfflinePackDownloadState.Complete) {
          onProgress?.({ state: 'complete', progress: 100 });
        }
      },
    );
  } catch (err) {
    console.warn('[map-offline] Failed to ensure offline pack:', err);
    onProgress?.({ state: 'error', progress: 0 });
  }
}

/** Delete the offline pack (e.g. to force a fresh download after map update). */
export async function deleteOfflinePack(): Promise<void> {
  try {
    await MapLibreGL.offlineManager.deletePack(PACK_NAME);
  } catch {
    // silent
  }
}
