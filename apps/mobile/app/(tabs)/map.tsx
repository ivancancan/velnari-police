// apps/mobile/app/(tabs)/map.tsx
import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { unitsApi, incidentsApi } from '@/lib/api';
import { useUnitStore } from '@/store/unit.store';

const CDMX = { latitude: 19.4326, longitude: -99.1332, latitudeDelta: 0.03, longitudeDelta: 0.03 };

const STATUS_MARKER_COLORS: Record<string, string> = {
  available: '#22C55E',
  en_route: '#3B82F6',
  on_scene: '#F59E0B',
  out_of_service: '#EF4444',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#22C55E',
};

interface Coord {
  latitude: number;
  longitude: number;
}

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const { callSign, status, nearbyUnits, setNearbyUnits, unitId: myUnitId } = useUnitStore();

  const [currentPos, setCurrentPos] = useState<Coord | null>(null);
  const [trail, setTrail] = useState<Coord[]>([]);
  const [following, setFollowing] = useState(true);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [openIncidents, setOpenIncidents] = useState<{ id: string; folio: string; type: string; priority: string; lat: number; lng: number; address?: string }[]>([]);
  const [showOverlay, setShowOverlay] = useState(true);

  // Watch position
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
          setTrail((prev) => [...prev, coord]);
          // Speed from GPS sensor (m/s -> km/h), fallback to 0
          const rawSpeed = loc.coords.speed;
          setSpeedKmh(rawSpeed != null && rawSpeed >= 0 ? Math.round(rawSpeed * 3.6) : 0);

          if (following && mapRef.current) {
            mapRef.current.animateToRegion({
              ...coord,
              latitudeDelta: 0.008,
              longitudeDelta: 0.008,
            }, 500);
          }
        },
      );
    })();

    return () => { sub?.remove(); };
  }, [following]);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setElapsedSecs((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch nearby units and open incidents
  useEffect(() => {
    async function load() {
      try {
        const [unitsRes, incidentsRes] = await Promise.all([
          unitsApi.getAll(),
          incidentsApi.getAll(),
        ]);
        // Filter out own unit and units without position
        const others = unitsRes.data
          .filter((u: any) => u.id !== myUnitId && u.lat != null && u.lng != null)
          .map((u: any) => ({ id: u.id, callSign: u.callSign, status: u.status, lat: u.lat!, lng: u.lng! }));
        setNearbyUnits(others);
        // Only show non-closed incidents
        setOpenIncidents(incidentsRes.data.filter((i: any) => i.status !== 'closed'));
      } catch {}
    }
    load();
  }, [myUnitId, setNearbyUnits]);

  const distanceKm = trail.length >= 2
    ? trail.reduce((acc, point, i) => {
        if (i === 0) return 0;
        const prev = trail[i - 1]!;
        const dLat = (point.latitude - prev.latitude) * 111;
        const dLng = (point.longitude - prev.longitude) * 111 * Math.cos(prev.latitude * Math.PI / 180);
        return acc + Math.sqrt(dLat * dLat + dLng * dLng);
      }, 0)
    : 0;

  const statusColor =
    status === 'available' ? '#22C55E' :
    status === 'en_route' ? '#3B82F6' :
    status === 'on_scene' ? '#F59E0B' : '#EF4444';

  const mins = Math.floor(elapsedSecs / 60);
  const secs = elapsedSecs % 60;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={currentPos ? { ...currentPos, latitudeDelta: 0.008, longitudeDelta: 0.008 } : CDMX}
        showsUserLocation={false}
        showsCompass
        mapType="standard"
      >
        {/* Trail polyline */}
        {trail.length >= 2 && (
          <Polyline
            coordinates={trail}
            strokeColor="#3B82F6"
            strokeWidth={4}
            lineDashPattern={[0]}
          />
        )}

        {/* Start point pin — where tracking began */}
        {trail.length > 0 && (
          <Marker coordinate={trail[0]!} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.startPin}>
              <Text style={styles.startPinText}>INICIO</Text>
              <View style={styles.startPinDot} />
            </View>
          </Marker>
        )}

        {/* Current position marker */}
        {currentPos && (
          <Marker coordinate={currentPos} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.markerOuter}>
              <View style={[styles.markerInner, { backgroundColor: statusColor }]}>
                <Text style={styles.markerText}>{callSign ?? '?'}</Text>
              </View>
            </View>
          </Marker>
        )}

        {/* Nearby unit markers */}
        {showOverlay && nearbyUnits.map((unit) => (
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

        {/* Open incident markers */}
        {showOverlay && openIncidents.map((incident) => (
          <Marker
            key={`inc-${incident.id}`}
            coordinate={{ latitude: incident.lat, longitude: incident.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.incidentMarker}>
              <View style={[styles.incidentTriangle, { borderBottomColor: PRIORITY_COLORS[incident.priority] ?? '#F59E0B' }]} />
              <Text style={styles.incidentLabel}>{incident.folio}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Stats overlay */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{trail.length}</Text>
          <Text style={styles.statLabel}>Puntos</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}
          </Text>
          <Text style={styles.statLabel}>Distancia</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {mins > 0 ? `${mins}m ${secs.toString().padStart(2, '0')}s` : `${secs}s`}
          </Text>
          <Text style={styles.statLabel}>Tiempo</Text>
        </View>
      </View>

      {/* Floating speed indicator */}
      {currentPos && (
        <View style={styles.speedBadge}>
          <Text style={styles.speedValue}>{speedKmh}</Text>
          <Text style={styles.speedUnit}>km/h</Text>
        </View>
      )}

      {/* Toggle overlay button */}
      <TouchableOpacity
        style={[styles.overlayToggle, showOverlay && styles.overlayToggleActive]}
        onPress={() => setShowOverlay((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.overlayToggleText}>{showOverlay ? '\u{1F465}' : '\u{1F441}'}</Text>
      </TouchableOpacity>

      {/* Coords readout */}
      {currentPos && (
        <View style={styles.coordsBar}>
          <Text style={styles.coordsText}>
            {currentPos.latitude.toFixed(5)}, {currentPos.longitude.toFixed(5)}
          </Text>
        </View>
      )}

      {/* Re-center button */}
      <TouchableOpacity
        style={[styles.centerButton, following && styles.centerButtonActive]}
        onPress={() => {
          setFollowing(true);
          if (currentPos && mapRef.current) {
            mapRef.current.animateToRegion({
              ...currentPos,
              latitudeDelta: 0.008,
              longitudeDelta: 0.008,
            }, 500);
          }
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.centerIcon}>◎</Text>
      </TouchableOpacity>

      {/* Clear trail */}
      {trail.length > 0 && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => { setTrail(currentPos ? [currentPos] : []); setElapsedSecs(0); }}
          activeOpacity={0.7}
        >
          <Text style={styles.clearText}>Limpiar ruta</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  map: { flex: 1 },

  // Marker
  markerOuter: { padding: 4, borderRadius: 20, backgroundColor: 'rgba(59,130,246,0.25)' },
  markerInner: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  markerText: { color: '#fff', fontSize: 10, fontWeight: '800', fontFamily: 'monospace' },

  // Stats bar — glassmorphism overlay
  statsBar: {
    position: 'absolute', top: 60, left: 16, right: 16,
    backgroundColor: 'rgba(15,23,42,0.75)', borderRadius: 20,
    flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(148,163,184,0.15)',
    // Note: for full glassmorphism blur, wrap in BlurView from expo-blur
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', fontFamily: 'monospace' },
  statLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(148,163,184,0.2)' },

  // Coords bar — larger monospace text
  coordsBar: {
    position: 'absolute', bottom: 108, alignSelf: 'center',
    backgroundColor: 'rgba(15,23,42,0.85)', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(148,163,184,0.12)',
  },
  coordsText: { color: '#3B82F6', fontSize: 14, fontFamily: 'monospace', fontWeight: '700', letterSpacing: 0.5 },

  // Re-center button — enlarged to 52px for gloves
  centerButton: {
    position: 'absolute', bottom: 108, right: 16,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(15,23,42,0.85)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#334155',
  },
  centerButtonActive: { borderColor: '#3B82F6' },
  centerIcon: { color: '#3B82F6', fontSize: 26 },

  // Start pin
  startPin: { alignItems: 'center' },
  startPinText: { backgroundColor: '#22C55E', color: '#fff', fontSize: 9, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#fff', marginBottom: 2 },
  startPinDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', borderWidth: 1.5, borderColor: '#fff' },

  // Speed badge
  speedBadge: {
    position: 'absolute', top: 130, right: 16,
    backgroundColor: 'rgba(15,23,42,0.85)', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(148,163,184,0.12)', minWidth: 56,
  },
  speedValue: { color: '#F8FAFC', fontSize: 22, fontWeight: '800', fontFamily: 'monospace' },
  speedUnit: { color: '#64748B', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 },

  // Other unit markers
  otherUnitMarker: { alignItems: 'center' },
  otherUnitDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  otherUnitLabel: { color: '#F8FAFC', fontSize: 8, fontWeight: '700', fontFamily: 'monospace', marginTop: 2, backgroundColor: 'rgba(15,23,42,0.7)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },

  // Incident markers
  incidentMarker: { alignItems: 'center' },
  incidentTriangle: { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderBottomWidth: 14, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#F59E0B' },
  incidentLabel: { color: '#F8FAFC', fontSize: 7, fontWeight: '700', fontFamily: 'monospace', marginTop: 2, backgroundColor: 'rgba(15,23,42,0.7)', paddingHorizontal: 3, paddingVertical: 1, borderRadius: 3, overflow: 'hidden' },

  // Overlay toggle
  overlayToggle: {
    position: 'absolute', top: 130, left: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(15,23,42,0.85)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#334155',
  },
  overlayToggleActive: { borderColor: '#3B82F6' },
  overlayToggleText: { fontSize: 20 },

  // Clear button
  clearButton: {
    position: 'absolute', bottom: 108, left: 16,
    backgroundColor: 'rgba(15,23,42,0.85)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, minHeight: 40,
    borderWidth: 1, borderColor: '#334155',
  },
  clearText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
});
