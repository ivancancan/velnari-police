// apps/mobile/app/(tabs)/map.tsx
//
// Field-officer map powered by MapLibre GL (vector tiles, offline-capable).
//
// Shows:
//   - My GPS dot with call sign (status color ring)
//   - My open/assigned incidents (tappable → detail modal)
//   - Nearby active units
//   - GPS trail from background tracking (only populated after iniciar rastreo)
//   - Re-center button
//   - Speed badge while moving
//   - Style switcher (Nocturno / Calles / Claro)
//
// Data savings:
//   - Tiles: served from local offline pack after first download (~30 MB, WiFi)
//   - API: 60-second in-memory cache — tab switching costs zero data
//
// Coordinate order: MapLibre uses GeoJSON [longitude, latitude].
// react-native-maps used { latitude, longitude } — don't mix them up.

import { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { unitsApi, incidentsApi } from '@/lib/api';
import { useUnitStore } from '@/store/unit.store';
import { useAuthStore } from '@/store/auth.store';
import { withCache, invalidateCache, CACHE_KEYS } from '@/lib/api-cache';
import {
  MAP_STYLES,
  DEFAULT_MAP_STYLE,
  ensureOfflinePack,
  type MapStyleKey,
  type OfflinePackStatus,
} from '@/lib/map-offline';
import IncidentDetailModal from '@/components/IncidentDetailModal';

// Suppress the MapLibre "no access token" warning — we use free CARTO tiles
// that don't require a token.
MapLibreGL.setAccessToken(null);

// Guadalajara city center as the cold-start default (GPS takes over quickly).
const DEFAULT_COORD: [number, number] = [-103.3496, 20.6597];

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high:     '#F97316',
  medium:   '#F59E0B',
  low:      '#22C55E',
};

const STATUS_COLORS: Record<string, string> = {
  available:      '#22C55E',
  en_route:       '#3B82F6',
  on_scene:       '#F59E0B',
  out_of_service: '#64748B',
};

interface OpenIncident {
  id: string;
  folio: string;
  priority: string;
  lat: number;
  lng: number;
}

export default function MapScreen() {
  const cameraRef = useRef<MapLibreGL.Camera>(null);

  const {
    callSign, status, nearbyUnits, setNearbyUnits,
    unitId: myUnitId, assignedIncident, focusCoords, setFocusCoords,
  } = useUnitStore();
  const myUserId = useAuthStore((s) => s.user?.id);

  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null); // [lng, lat]
  const [trail, setTrail] = useState<[number, number][]>([]); // GeoJSON [lng, lat]
  const [following, setFollowing] = useState(true);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [openIncidents, setOpenIncidents] = useState<OpenIncident[]>([]);
  const [detailIncidentId, setDetailIncidentId] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyleKey>(DEFAULT_MAP_STYLE);
  const [offlinePack, setOfflinePack] = useState<OfflinePackStatus>({ state: 'idle', progress: 0 });

  // Ensure offline pack is downloaded in the background the first time the
  // map tab opens. No-op if already downloaded.
  useEffect(() => {
    ensureOfflinePack(mapStyle, setOfflinePack);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount

  // Foreground position watcher — drives the "where am I" dot and speed badge.
  // Trail comes exclusively from background-tracking API history.
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
        (loc) => {
          const coord: [number, number] = [loc.coords.longitude, loc.coords.latitude];
          setCurrentPos(coord);
          const rawSpeed = loc.coords.speed;
          setSpeedKmh(rawSpeed != null && rawSpeed >= 0 ? Math.round(rawSpeed * 3.6) : 0);
        },
      );
    })();
    return () => { sub?.remove?.(); };
  }, []);

  // Animate camera to follow officer when following mode is on.
  useEffect(() => {
    if (!following || !currentPos || !cameraRef.current) return;
    cameraRef.current.setCamera({
      centerCoordinate: currentPos,
      zoomLevel: 14,
      animationDuration: 500,
      animationMode: 'easeTo',
    });
  }, [currentPos, following]);

  // Navigate to incident location when opened from IncidentDetailModal.
  useEffect(() => {
    if (!focusCoords || !cameraRef.current) return;
    setFollowing(false);
    cameraRef.current.setCamera({
      centerCoordinate: [focusCoords.lng, focusCoords.lat],
      zoomLevel: 15,
      animationDuration: 600,
      animationMode: 'flyTo',
    });
    setFocusCoords(null);
  }, [focusCoords, setFocusCoords]);

  // Reload units + incidents on tab focus (60s cache keeps data traffic minimal).
  useFocusEffect(
    useCallback(() => {
      async function load(): Promise<void> {
        try {
          const [unitsRes, incidentsRes] = await Promise.all([
            withCache(CACHE_KEYS.units, () => unitsApi.getAll()),
            withCache(CACHE_KEYS.incidents, () => incidentsApi.getAll()),
          ]);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const others = (unitsRes.data as any[])
            .filter((u) => u.id !== myUnitId && u.lat != null && u.lng != null)
            .map((u) => ({ id: u.id, callSign: u.callSign, status: u.status, lat: u.lat, lng: u.lng }));
          setNearbyUnits(others);

          setOpenIncidents(
            incidentsRes.data
              .filter((i) =>
                i.status !== 'closed' &&
                (i.assignedUnitId === myUnitId || i.createdBy === myUserId),
              )
              .map((i) => ({ id: i.id, folio: i.folio, priority: i.priority, lat: i.lat, lng: i.lng })),
          );
        } catch {
          // Silent — map still shows position.
        }

        // Load GPS trail from background-tracking history (last 12h).
        // Only has points if the officer started "Iniciar rastreo".
        if (!myUnitId) return;
        try {
          const to = new Date().toISOString();
          const from = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
          const histRes = await unitsApi.getHistory(myUnitId, from, to);
          if (histRes.data.length > 0) {
            setTrail(histRes.data.map((p) => [p.lng, p.lat] as [number, number]));
          }
        } catch {
          // History is best-effort
        }
      }
      void load();
    }, [myUnitId, myUserId, setNearbyUnits]),
  );

  const myStatusColor = STATUS_COLORS[status ?? ''] ?? '#94A3B8';

  const trailGeoJSON: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: trail },
    properties: {},
  };

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView
        style={styles.map}
        styleURL={MAP_STYLES[mapStyle].url}
        compassEnabled
        compassViewPosition={0}
        onPress={() => setFollowing(false)}
        attributionEnabled={false}
        logoEnabled={false}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: DEFAULT_COORD, zoomLevel: 13 }}
        />

        {/* GPS trail — only renders if background tracking produced history */}
        {trail.length > 1 && (
          <MapLibreGL.ShapeSource id="trail-src" shape={trailGeoJSON}>
            <MapLibreGL.LineLayer
              id="trail-line"
              style={{ lineColor: '#3B82F6', lineWidth: 3, lineOpacity: 0.85 }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* My live position */}
        {currentPos && (
          <MapLibreGL.PointAnnotation id="me" coordinate={currentPos}>
            <View style={styles.meMarkerOuter}>
              <View style={[styles.meMarkerInner, { backgroundColor: myStatusColor }]}>
                <Text style={styles.meMarkerText}>{callSign ?? 'YO'}</Text>
              </View>
            </View>
          </MapLibreGL.PointAnnotation>
        )}

        {/* Nearby active units */}
        {nearbyUnits.map((unit) => (
          <MapLibreGL.PointAnnotation
            key={`unit-${unit.id}`}
            id={`unit-${unit.id}`}
            coordinate={[unit.lng, unit.lat]}
          >
            <View style={styles.otherUnitMarker}>
              <View style={[styles.otherUnitDot, { backgroundColor: STATUS_COLORS[unit.status] ?? '#64748B' }]} />
              <Text style={styles.otherUnitLabel}>{unit.callSign}</Text>
            </View>
          </MapLibreGL.PointAnnotation>
        ))}

        {/* Officer's open incidents */}
        {openIncidents.map((incident) => {
          const isMine = assignedIncident?.id === incident.id;
          return (
            <MapLibreGL.PointAnnotation
              key={`inc-${incident.id}`}
              id={`inc-${incident.id}`}
              coordinate={[incident.lng, incident.lat]}
              onSelected={() => setDetailIncidentId(incident.id)}
            >
              <View style={isMine ? styles.incidentMarkerMine : styles.incidentMarker}>
                {isMine && <View style={styles.incidentHaloMine} />}
                <View
                  style={[
                    styles.incidentTriangle,
                    { borderBottomColor: PRIORITY_COLORS[incident.priority] ?? '#F59E0B' },
                  ]}
                />
                <Text style={[styles.incidentLabel, isMine && styles.incidentLabelMine]}>
                  {isMine ? `⭐ ${incident.folio}` : incident.folio}
                </Text>
              </View>
            </MapLibreGL.PointAnnotation>
          );
        })}
      </MapLibreGL.MapView>

      {/* Style switcher — top-left */}
      <View style={styles.styleSwitcher} pointerEvents="box-none">
        {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.styleButton, mapStyle === key && styles.styleButtonActive]}
            onPress={() => setMapStyle(key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.styleButtonText, mapStyle === key && styles.styleButtonTextActive]}>
              {MAP_STYLES[key].label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Offline pack download indicator */}
      {offlinePack.state === 'downloading' && (
        <View style={styles.offlineBadge} pointerEvents="none">
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text style={styles.offlineBadgeText}>Mapa offline {offlinePack.progress}%</Text>
        </View>
      )}

      {/* Speed badge — only while moving */}
      {speedKmh > 3 && (
        <View style={styles.speedBadge} pointerEvents="none">
          <Text style={styles.speedValue}>{speedKmh}</Text>
          <Text style={styles.speedUnit}>km/h</Text>
        </View>
      )}

      {/* Re-center */}
      <TouchableOpacity
        style={[styles.centerButton, following && styles.centerButtonActive]}
        onPress={() => {
          setFollowing(true);
          if (currentPos && cameraRef.current) {
            cameraRef.current.setCamera({
              centerCoordinate: currentPos,
              zoomLevel: 14,
              animationDuration: 500,
              animationMode: 'easeTo',
            });
          }
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={following ? 'Siguiendo posición' : 'Centrar en mi ubicación'}
      >
        <Text style={styles.centerIcon}>◎</Text>
      </TouchableOpacity>

      <IncidentDetailModal incidentId={detailIncidentId} onClose={() => setDetailIncidentId(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  map: { flex: 1 },

  // My marker
  meMarkerOuter: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(59,130,246,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  meMarkerInner: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#F8FAFC',
    shadowColor: '#000', shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 3, elevation: 4,
  },
  meMarkerText: { color: '#F8FAFC', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  // Other units
  otherUnitMarker: {
    alignItems: 'center', paddingHorizontal: 6, paddingVertical: 4,
    backgroundColor: '#0F172AE6', borderRadius: 8,
    borderWidth: 1, borderColor: '#334155',
  },
  otherUnitDot: { width: 10, height: 10, borderRadius: 5 },
  otherUnitLabel: { color: '#CBD5E1', fontSize: 10, fontWeight: '700', marginTop: 2 },

  // Incidents
  incidentMarker: { alignItems: 'center' },
  incidentMarkerMine: { alignItems: 'center', position: 'relative' },
  incidentHaloMine: {
    position: 'absolute', top: -6, left: -6, right: -6, bottom: -6,
    borderRadius: 40, backgroundColor: 'rgba(251,191,36,0.25)',
    borderWidth: 2, borderColor: '#FBBF24',
  },
  incidentTriangle: {
    width: 0, height: 0,
    borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 18,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  incidentLabel: {
    color: '#F8FAFC', fontSize: 10, fontWeight: '800', marginTop: 2,
    backgroundColor: '#0F172AE0', paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 3, overflow: 'hidden',
  },
  incidentLabelMine: { backgroundColor: '#78350FE6', color: '#FCD34D' },

  // Style switcher
  styleSwitcher: {
    position: 'absolute', top: 16, left: 16,
    flexDirection: 'row', gap: 6,
  },
  styleButton: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#1E293BEE', borderRadius: 16,
    borderWidth: 1, borderColor: '#334155',
  },
  styleButtonActive: { backgroundColor: '#3B82F6', borderColor: '#60A5FA' },
  styleButtonText: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  styleButtonTextActive: { color: '#F8FAFC' },

  // Offline download badge
  offlineBadge: {
    position: 'absolute', top: 56, left: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1E293BEE', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: '#334155',
  },
  offlineBadgeText: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },

  // Speed badge
  speedBadge: {
    position: 'absolute', top: 60, right: 16,
    backgroundColor: '#0F172AEE', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8,
    alignItems: 'center', borderWidth: 1, borderColor: '#334155',
  },
  speedValue: { color: '#F8FAFC', fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  speedUnit: { color: '#94A3B8', fontSize: 9, fontWeight: '600', letterSpacing: 1, marginTop: -2 },

  // Re-center button
  centerButton: {
    position: 'absolute', bottom: 30, right: 16,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#334155',
    shadowColor: '#000', shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 6, elevation: 6,
  },
  centerButtonActive: { backgroundColor: '#3B82F6', borderColor: '#60A5FA' },
  centerIcon: { color: '#F8FAFC', fontSize: 24, fontWeight: '700' },
});
