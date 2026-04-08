// apps/mobile/app/(tabs)/home.tsx
import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, RefreshControl,
} from 'react-native';
import { useAuthStore } from '@/store/auth.store';
import { useUnitStore } from '@/store/unit.store';
import { unitsApi, incidentsApi } from '@/lib/api';
import { startLocationTracking, stopLocationTracking } from '@/lib/location';

const STATUS_OPTIONS = [
  { value: 'available', label: 'Disponible', color: '#22C55E' },
  { value: 'en_route', label: 'En camino', color: '#3B82F6' },
  { value: 'on_scene', label: 'En escena', color: '#F59E0B' },
  { value: 'out_of_service', label: 'Fuera de servicio', color: '#EF4444' },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#EF4444', high: '#F97316', medium: '#F59E0B', low: '#22C55E',
};

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { unitId, callSign, status, assignedIncident, setUnit, setStatus, setAssignedIncident } = useUnitStore();
  const [refreshing, setRefreshing] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);

  async function loadUnitAndIncident() {
    try {
      const unitsRes = await unitsApi.getAll();
      const myUnit = unitsRes.data.find((u) => u.assignedUserId === user?.id);
      if (!myUnit) return;
      setUnit(myUnit.id, myUnit.callSign, myUnit.status);

      const incidentsRes = await incidentsApi.getAll();
      const myIncident = incidentsRes.data.find(
        (i) => i.assignedUnitId === myUnit.id && i.status !== 'closed',
      );
      setAssignedIncident(myIncident ?? null);
    } catch {
      // silent — user sees stale data
    }
  }

  useEffect(() => { loadUnitAndIncident(); }, []);

  async function handleStatusChange(newStatus: string) {
    if (!unitId) {
      Alert.alert('Sin unidad asignada', 'Tu usuario no tiene una unidad asignada.');
      return;
    }
    try {
      await unitsApi.updateStatus(unitId, newStatus);
      setStatus(newStatus);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el estado.');
    }
  }

  async function toggleTracking() {
    if (!unitId) { Alert.alert('Sin unidad asignada'); return; }
    if (trackingActive) {
      await stopLocationTracking();
      setTrackingActive(false);
    } else {
      const started = await startLocationTracking(unitId);
      setTrackingActive(started);
      if (!started) {
        Alert.alert('Permiso denegado', 'Activa los permisos de ubicación en configuración.');
      }
    }
  }

  const currentStatusOption = STATUS_OPTIONS.find((s) => s.value === status);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await loadUnitAndIncident();
            setRefreshing(false);
          }}
        />
      }
    >
      {/* Unit header */}
      <View style={styles.unitCard}>
        <Text style={styles.callSign}>{callSign ?? 'Sin unidad'}</Text>
        <View style={[styles.statusBadge, { backgroundColor: (currentStatusOption?.color ?? '#64748B') + '22' }]}>
          <Text style={[styles.statusText, { color: currentStatusOption?.color ?? '#64748B' }]}>
            {currentStatusOption?.label ?? status}
          </Text>
        </View>
      </View>

      {/* GPS tracking toggle */}
      <TouchableOpacity
        style={[styles.gpsButton, trackingActive && styles.gpsButtonActive]}
        onPress={toggleTracking}
      >
        <Text style={styles.gpsButtonText}>
          {trackingActive ? '📍 GPS activo — toca para detener' : '📍 Activar GPS'}
        </Text>
      </TouchableOpacity>

      {/* Status selector */}
      <Text style={styles.sectionLabel}>Cambiar estado</Text>
      <View style={styles.statusGrid}>
        {STATUS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.statusOption,
              status === opt.value && { borderColor: opt.color, backgroundColor: opt.color + '22' },
            ]}
            onPress={() => handleStatusChange(opt.value)}
          >
            <Text style={[styles.statusOptionText, status === opt.value && { color: opt.color }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Assigned incident */}
      <Text style={styles.sectionLabel}>Incidente asignado</Text>
      {assignedIncident ? (
        <View style={styles.incidentCard}>
          <View style={styles.incidentHeader}>
            <Text style={styles.incidentFolio}>{assignedIncident.folio}</Text>
            <View style={[styles.priorityBadge, { backgroundColor: (PRIORITY_COLORS[assignedIncident.priority] ?? '#F59E0B') + '22' }]}>
              <Text style={[styles.priorityText, { color: PRIORITY_COLORS[assignedIncident.priority] ?? '#F59E0B' }]}>
                {assignedIncident.priority.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.incidentType}>{assignedIncident.type}</Text>
          {assignedIncident.address ? (
            <Text style={styles.incidentAddress}>{assignedIncident.address}</Text>
          ) : null}
          {assignedIncident.description ? (
            <Text style={styles.incidentDesc}>{assignedIncident.description}</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Sin incidente asignado</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', padding: 16 },
  unitCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  callSign: { color: '#F8FAFC', fontSize: 22, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '600' },
  gpsButton: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 12, marginBottom: 16, alignItems: 'center' },
  gpsButtonActive: { borderColor: '#22C55E', backgroundColor: '#052e16' },
  gpsButtonText: { color: '#F8FAFC', fontSize: 13 },
  sectionLabel: { color: '#64748B', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  statusOption: { borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  statusOptionText: { color: '#94A3B8', fontSize: 13 },
  incidentCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 24 },
  incidentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  incidentFolio: { color: '#F8FAFC', fontWeight: '700', fontSize: 16 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  priorityText: { fontSize: 11, fontWeight: '600' },
  incidentType: { color: '#94A3B8', fontSize: 13, textTransform: 'capitalize', marginBottom: 4 },
  incidentAddress: { color: '#F8FAFC', fontSize: 14, marginBottom: 4 },
  incidentDesc: { color: '#64748B', fontSize: 13 },
  emptyCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 32, alignItems: 'center' },
  emptyText: { color: '#64748B', fontSize: 14 },
});
