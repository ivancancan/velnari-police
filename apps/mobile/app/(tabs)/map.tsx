// apps/mobile/app/(tabs)/map.tsx
//
// Simplified field-unit map view using react-native-maps (Apple Maps on iOS).
// We tried MapLibre for offline tiles + style switching but hit a persistent
// MLRNPointAnnotation KVO crash that we couldn't work around. Stability wins
// for field ops — we keep data-saving via api-cache.ts instead.
//
// Shows:
//   - My GPS dot with my call sign
//   - Open incidents I created or that are assigned to me (tappable → modal)
//   - Nearby active units
//   - Re-center button, speed badge, GPS trail from background-tracking history

import { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { unitsApi, incidentsApi } from '@/lib/api';
import { useUnitStore } from '@/store/unit.store';
import { useAuthStore } from '@/store/auth.store';
import { withCache, CACHE_KEYS } from '@/lib/api-cache';
import IncidentDetailModal from '@/components/IncidentDetailModal';

const DEFAULT_REGION = {
  latitude: 20.6597,
  longitude: -103.3496,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#22C55E',
};

// Single-letter shorthand so colorblind officers can distinguish priority
// without relying on hue alone. Read aloud by screen readers via the marker's
// accessibilityLabel below.
const PRIORITY_LETTER: Record<string, string> = {
  critical: 'C',
  high: 'A',
  medium: 'M',
  low: 'B',
};

const STATUS_MARKER_COLORS: Record<string, string> = {
  available: '#22C55E',
  en_route: '#3B82F6',
  on_scene: '#F59E0B',
  out_of_service: '#64748B',
};

interface Coord {
  latitude: number;
  longitude: number;
}

interface OpenIncident {
  id: string;
  folio: string;
  type: string;
  priority: string;
  lat: number;
  lng: number;
  address?: string;
}

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const {
    callSign, status, nearbyUnits, setNearbyUnits,
    unitId: myUnitId, assignedIncident, focusCoords, setFocusCoords,
  } = useUnitStore();
  const myUserId = useAuthStore((s) => s.user?.id);

  const [currentPos, setCurrentPos] = useState<Coord | null>(null);
  const [trail, setTrail] = useState<Coord[]>([]);
  const [following, setFollowing] = useState(true);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [openIncidents, setOpenIncidents] = useState<OpenIncident[]>([]);
  const [detailIncidentId, setDetailIncidentId] = useState<string | null>(null);

  // Foreground GPS — drives the "where am I" dot, speed badge, and follow-camera.
  // Trail is loaded from the API history (background tracking), not accumulated here,
  // so we don't draw a stale trail segment before the officer taps "iniciar rastreo".
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
        (loc) => {
          const coord: Coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setCurrentPos(coord);
          const rawSpeed = loc.coords.speed;
          setSpeedKmh(rawSpeed != null && rawSpeed >= 0 ? Math.round(rawSpeed * 3.6) : 0);
          if (following && mapRef.current) {
            mapRef.current.animateToRegion(
              { ...coord, latitudeDelta: 0.008, longitudeDelta: 0.008 },
              500,
            );
          }
        },
      );
    })();
    return () => { sub?.remove?.(); };
  }, [following]);

  // Navigate to focusCoords when set from IncidentDetailModal.
  useEffect(() => {
    if (!focusCoords || !mapRef.current) return;
    setFollowing(false);
    mapRef.current.animateToRegion(
      { latitude: focusCoords.lat, longitude: focusCoords.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 },
      600,
    );
    setFocusCoords(null);
  }, [focusCoords, setFocusCoords]);

  // Reload units + incidents on tab focus (60s TTL cache keeps traffic minimal).
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
          // Officer only sees incidents they reported or that are assigned to them.
          setOpenIncidents(
            incidentsRes.data
              .filter((i) =>
                i.status !== 'closed' &&
                (i.assignedUnitId === myUnitId || i.createdBy === myUserId),
              )
              .map((i) => ({
                id: i.id,
                folio: i.folio,
                type: i.type,
                priority: i.priority,
                lat: i.lat,
                lng: i.lng,
                address: i.address,
              })),
          );
        } catch { /* silent */ }

        if (!myUnitId) return;
        try {
          const to = new Date().toISOString();
          const from = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
          const histRes = await unitsApi.getHistory(myUnitId, from, to);
          if (histRes.data.length > 0) {
            setTrail(histRes.data.map((p) => ({ latitude: p.lat, longitude: p.lng })));
          }
        } catch { /* history is best-effort */ }
      }
      void load();
    }, [myUnitId, myUserId, setNearbyUnits]),
  );

  const myStatusColor =
    status === 'available' ? '#22C55E' :
    status === 'en_route'  ? '#3B82F6' :
    status === 'on_scene'  ? '#F59E0B' : '#94A3B8';

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={currentPos ? { ...currentPos, latitudeDelta: 0.008, longitudeDelta: 0.008 } : DEFAULT_REGION}
        showsUserLocation={false}
        showsCompass
        onPanDrag={() => setFollowing(false)}
      >
        {trail.length > 1 && (
          <Polyline coordinates={trail} strokeColor="#3B82F6" strokeWidth={3} />
        )}

        {currentPos && (
          <Marker coordinate={currentPos} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.meMarkerOuter}>
              <View style={[styles.meMarkerInner, { backgroundColor: myStatusColor }]}>
                <Text style={styles.meMarkerText}>{callSign ?? 'YO'}</Text>
              </View>
            </View>
          </Marker>
        )}

        {nearbyUnits.map((unit) => (
          <Marker
            key={`unit-${unit.id}`}
            coordinate={{ latitude: unit.lat, longitude: unit.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.otherUnitMarker}>
              <View style={[styles.otherUnitDot, { backgroundColor: STATUS_MARKER_COLORS[unit.status] ?? '#64748B' }]} />
              <Text style={styles.otherUnitLabel}>{unit.callSign}</Text>
            </View>
          </Marker>
        ))}

        {openIncidents.map((incident) => {
          const isMine = assignedIncident?.id === incident.id;
          return (
            <Marker
              key={`inc-${incident.id}`}
              coordinate={{ latitude: incident.lat, longitude: incident.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => setDetailIncidentId(incident.id)}
              accessibilityRole="button"
              accessibilityLabel={`Incidente ${incident.folio}${isMine ? ' (asignado a ti)' : ''}, prioridad ${incident.priority}`}
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
                  {isMine ? '⭐ ' : ''}
                  <Text style={styles.priorityTag}>
                    [{PRIORITY_LETTER[incident.priority] ?? '?'}]
                  </Text>{' '}
                  {incident.folio}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {currentPos && speedKmh > 3 && (
        <View style={styles.speedBadge} pointerEvents="none">
          <Text style={styles.speedValue}>{speedKmh}</Text>
          <Text style={styles.speedUnit}>km/h</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.centerButton, following && styles.centerButtonActive]}
        onPress={() => {
          setFollowing(true);
          if (currentPos && mapRef.current) {
            mapRef.current.animateToRegion(
              { ...currentPos, latitudeDelta: 0.008, longitudeDelta: 0.008 },
              500,
            );
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

  otherUnitMarker: {
    alignItems: 'center', paddingHorizontal: 6, paddingVertical: 4,
    backgroundColor: '#0F172AE6', borderRadius: 8,
    borderWidth: 1, borderColor: '#334155',
  },
  otherUnitDot: { width: 10, height: 10, borderRadius: 5 },
  otherUnitLabel: { color: '#CBD5E1', fontSize: 10, fontWeight: '700', marginTop: 2 },

  incidentMarker: { alignItems: 'center' },
  incidentMarkerMine: { alignItems: 'center', position: 'relative' },
  incidentHaloMine: {
    position: 'absolute',
    top: -6, left: -6, right: -6, bottom: -6,
    borderRadius: 40,
    backgroundColor: 'rgba(251, 191, 36, 0.25)',
    borderWidth: 2, borderColor: '#FBBF24',
  },
  incidentLabelMine: { backgroundColor: '#78350FE6', color: '#FCD34D' },
  priorityTag: { fontWeight: '900', letterSpacing: 0.5 },
  incidentTriangle: {
    width: 0, height: 0,
    borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 18,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  incidentLabel: {
    color: '#F8FAFC', fontSize: 10, fontWeight: '800', marginTop: 2,
    backgroundColor: '#0F172AE0',
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 3, overflow: 'hidden',
  },

  speedBadge: {
    position: 'absolute', top: 60, right: 16,
    backgroundColor: '#0F172AEE', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8,
    alignItems: 'center', borderWidth: 1, borderColor: '#334155',
  },
  speedValue: { color: '#F8FAFC', fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  speedUnit: { color: '#94A3B8', fontSize: 9, fontWeight: '600', letterSpacing: 1, marginTop: -2 },

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
