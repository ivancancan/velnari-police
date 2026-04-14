// apps/mobile/app/(tabs)/map.tsx
//
// Simplified field-unit map view.
//
// An officer doesn't need to filter other units by status from here — that's
// command-center work. All they need is: "where am I, where are nearby open
// incidents, where are my colleagues". Everything else got cut.
//
// Shows:
//   - My GPS dot with my call sign (always visible when location permission granted)
//   - Open incidents (tappable → opens detail modal)
//   - Nearby active units (all statuses, single style, no filter chips)
//   - Re-center button
//   - Speed badge only while moving
//
// Intentionally removed:
//   - Status filter chips (Todas/Disponibles/En ruta/En escena)
//   - "Limpiar ruta" button
//   - Start-point marker ("INICIO")
//   - Trail polyline (distraction — trails belong on command map, not field map)
//   - Distance/time/points stats bar (cognitive load with no operational value)
//   - People/person-eye toggle (unnecessary)

import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { unitsApi, incidentsApi } from '@/lib/api';
import { useUnitStore } from '@/store/unit.store';
import IncidentDetailModal from '@/components/IncidentDetailModal';

const DEFAULT_REGION = { latitude: 19.4326, longitude: -99.1332, latitudeDelta: 0.03, longitudeDelta: 0.03 };

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#22C55E',
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
  const { callSign, status, nearbyUnits, setNearbyUnits, unitId: myUnitId, assignedIncident } = useUnitStore();

  const [currentPos, setCurrentPos] = useState<Coord | null>(null);
  const [following, setFollowing] = useState(true);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [openIncidents, setOpenIncidents] = useState<OpenIncident[]>([]);
  const [detailIncidentId, setDetailIncidentId] = useState<string | null>(null);

  // Watch user's position. The map tab uses its own watchPosition (foreground
  // only) so the blue "where am I" dot animates immediately even if background
  // tracking isn't started yet. Background tracking lives in home.tsx.
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
            mapRef.current.animateToRegion({ ...coord, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 500);
          }
        },
      );
    })();
    return () => {
      sub?.remove?.();
    };
  }, [following]);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const [unitsRes, incidentsRes] = await Promise.all([
          unitsApi.getAll(),
          incidentsApi.getAll(),
        ]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const others = (unitsRes.data as any[])
          .filter((u) => u.id !== myUnitId && u.lat != null && u.lng != null)
          .map((u) => ({ id: u.id, callSign: u.callSign, status: u.status, lat: u.lat, lng: u.lng }));
        setNearbyUnits(others);
        setOpenIncidents(
          incidentsRes.data
            .filter((i) => i.status !== 'closed')
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
      } catch {
        // Silent fail — map still shows user position.
      }
    }
    void load();
  }, [myUnitId, setNearbyUnits]);

  const myStatusColor =
    status === 'available' ? '#22C55E' :
    status === 'en_route' ? '#3B82F6' :
    status === 'on_scene' ? '#F59E0B' : '#94A3B8';

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
        {/* My live position */}
        {currentPos && (
          <Marker coordinate={currentPos} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.meMarkerOuter}>
              <View style={[styles.meMarkerInner, { backgroundColor: myStatusColor }]}>
                <Text style={styles.meMarkerText}>{callSign ?? 'YO'}</Text>
              </View>
            </View>
          </Marker>
        )}

        {/* Nearby active units */}
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

        {/* Open incidents. The officer's own assigned incident gets a
            gold pulsing ring so they can spot it instantly among many. */}
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
                  {isMine ? `⭐ ${incident.folio}` : incident.folio}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Floating speed badge — only while actually moving */}
      {currentPos && speedKmh > 3 && (
        <View style={styles.speedBadge} pointerEvents="none">
          <Text style={styles.speedValue}>{speedKmh}</Text>
          <Text style={styles.speedUnit}>km/h</Text>
        </View>
      )}

      {/* Re-center button */}
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

  // My marker
  meMarkerOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(59,130,246,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meMarkerInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#F8FAFC',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 4,
  },
  meMarkerText: { color: '#F8FAFC', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  // Other units
  otherUnitMarker: {
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: '#0F172AE6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  otherUnitDot: { width: 10, height: 10, borderRadius: 5 },
  otherUnitLabel: { color: '#CBD5E1', fontSize: 10, fontWeight: '700', marginTop: 2 },

  // Incidents
  incidentMarker: { alignItems: 'center' },
  incidentMarkerMine: { alignItems: 'center', position: 'relative' },
  incidentHaloMine: {
    position: 'absolute',
    top: -6, left: -6, right: -6, bottom: -6,
    borderRadius: 40,
    backgroundColor: 'rgba(251, 191, 36, 0.25)',
    borderWidth: 2,
    borderColor: '#FBBF24',
  },
  incidentLabelMine: {
    backgroundColor: '#78350FE6',
    color: '#FCD34D',
  },
  incidentTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  incidentLabel: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
    backgroundColor: '#0F172AE0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },

  // Speed badge
  speedBadge: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: '#0F172AEE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  speedValue: { color: '#F8FAFC', fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  speedUnit: { color: '#94A3B8', fontSize: 9, fontWeight: '600', letterSpacing: 1, marginTop: -2 },

  // Center button
  centerButton: {
    position: 'absolute',
    bottom: 30,
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 6,
  },
  centerButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#60A5FA',
  },
  centerIcon: { color: '#F8FAFC', fontSize: 24, fontWeight: '700' },
});
