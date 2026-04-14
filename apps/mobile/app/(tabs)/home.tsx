// apps/mobile/app/(tabs)/home.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, RefreshControl, Vibration,
  TextInput, Animated, Easing,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '@/store/auth.store';
import { useUnitStore } from '@/store/unit.store';
import { unitsApi, incidentsApi, patrolsApi } from '@/lib/api';
import { startLocationTracking, stopLocationTracking } from '@/lib/location';
import { flushQueue, enqueue } from '@/lib/offline-queue';
import { flushPhotoQueue, enqueuePhoto } from '@/lib/photo-queue';
import { flushLocationQueue } from '@/lib/location-queue';
import IncidentDetailModal from '@/components/IncidentDetailModal';
import VoiceNoteButton from '@/components/VoiceNoteButton';

const STATUS_OPTIONS = [
  { value: 'available', label: 'Disponible', color: '#22C55E', icon: '✓', iconLabel: 'Listo' },
  { value: 'en_route', label: 'En camino', color: '#3B82F6', icon: '→', iconLabel: 'Ruta' },
  { value: 'on_scene', label: 'En escena', color: '#F59E0B', icon: '◉', iconLabel: 'Escena' },
  { value: 'out_of_service', label: 'Fuera de servicio', color: '#EF4444', icon: '✕', iconLabel: 'Fuera' },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#EF4444', high: '#F97316', medium: '#F59E0B', low: '#22C55E',
};

const TYPE_LABELS: Record<string, string> = {
  robbery: 'Robo', assault: 'Agresión', traffic: 'Accidente vial',
  noise: 'Ruido', domestic: 'Violencia doméstica',
  missing_person: 'Persona desaparecida', other: 'Otro',
};

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { unitId, callSign, status, assignedIncident, setUnit, setStatus, setAssignedIncident } = useUnitStore();
  const [refreshing, setRefreshing] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);

  // Pulsing glow animation for SOS button
  const pulseAnim = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsCount, setGpsCount] = useState(0);
  const [noteText, setNoteText] = useState('');
  const [sendingNote, setSendingNote] = useState(false);
  const [closingIncident, setClosingIncident] = useState(false);
  const [sendingPanic, setSendingPanic] = useState(false);
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [detailIncidentId, setDetailIncidentId] = useState<string | null>(null);

  // Patrol state
  interface PatrolInfo {
    id: string; unitId: string; sectorId: string; status: string;
    startAt: string; endAt: string; acceptedAt?: string;
    sector?: { id: string; name: string };
  }
  const [pendingPatrols, setPendingPatrols] = useState<PatrolInfo[]>([]);
  const [activePatrol, setActivePatrol] = useState<PatrolInfo | null>(null);
  const [acceptingPatrol, setAcceptingPatrol] = useState(false);

  const loadUnitAndIncident = useCallback(async () => {
    try {
      const [flushed, photosFlushed, locationFlushed] = await Promise.allSettled([
        flushQueue(),
        flushPhotoQueue(),
        flushLocationQueue(),
      ]);

      const jsonSuccess = flushed.status === 'fulfilled' ? flushed.value.success : 0;
      const photoSuccess = photosFlushed.status === 'fulfilled' ? photosFlushed.value.success : 0;
      const locationSent = locationFlushed.status === 'fulfilled' ? locationFlushed.value.sent : 0;
      const totalSynced = jsonSuccess + photoSuccess + locationSent;

      if (totalSynced > 0) {
        const parts: string[] = [];
        if (jsonSuccess > 0) parts.push(`${jsonSuccess} acciones`);
        if (photoSuccess > 0) parts.push(`${photoSuccess} foto(s)`);
        if (locationSent > 0) parts.push(`${locationSent} punto(s) GPS`);
        Alert.alert('Sincronizado', `${parts.join(', ')} enviadas.`);
      }

      const unitsRes = await unitsApi.getAll();
      const myUnit = unitsRes.data.find((u) => u.assignedUserId === user?.id);
      if (!myUnit) return;
      setUnit(myUnit.id, myUnit.callSign, myUnit.status);
      if (myUnit.lat && myUnit.lng) {
        setCurrentCoords({ lat: myUnit.lat, lng: myUnit.lng });
      }

      // Load patrols for this unit
      try {
        const patrolsRes = await patrolsApi.getForUnit(myUnit.id);
        const scheduled = patrolsRes.data.filter((p) => p.status === 'scheduled');
        const active = patrolsRes.data.find((p) => p.status === 'active') ?? null;
        setPendingPatrols(scheduled);
        setActivePatrol(active);
      } catch {
        // silent — patrols are non-critical
      }

      const incidentsRes = await incidentsApi.getAll();
      const myIncident = incidentsRes.data.find(
        (i) => i.assignedUnitId === myUnit.id && i.status !== 'closed',
      );
      setAssignedIncident(myIncident ?? null);
    } catch {
      // silent
    }
  }, [user?.id]);

  useEffect(() => { loadUnitAndIncident(); }, [loadUnitAndIncident]);

  // Poll current position when tracking
  useEffect(() => {
    if (!trackingActive || !unitId) return;
    const interval = setInterval(async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setCurrentCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        setGpsCount((c) => c + 1);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [trackingActive, unitId]);

  async function handleStatusChange(newStatus: string) {
    if (!unitId) {
      Alert.alert('Sin unidad', 'No tienes una unidad asignada.');
      return;
    }
    try {
      await unitsApi.updateStatus(unitId, newStatus);
      setStatus(newStatus);
      // Pattern haptic gives tactile confirmation with gloves on.
      Vibration.vibrate([0, 100, 50, 100]);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el estado.');
    }
  }

  async function toggleTracking() {
    if (!unitId) {
      Alert.alert('Sin unidad asignada', 'No tienes una patrulla asignada. Contacta a tu supervisor.');
      return;
    }
    if (trackingActive) {
      // Safety interlock: never let an officer disable GPS while an incident
      // is assigned or they're on-scene. The command center relies on their
      // position for coordination; losing it mid-operation is dangerous.
      if (assignedIncident && (assignedIncident.status === 'assigned' || assignedIncident.status === 'on_scene')) {
        Alert.alert(
          'GPS bloqueado',
          `No puedes detener el rastreo mientras tienes un incidente activo (${assignedIncident.folio ?? ''}). Cierra el incidente primero.`,
        );
        return;
      }
      await stopLocationTracking();
      setTrackingActive(false);
      setGpsCount(0);
      Vibration.vibrate([0, 60, 40, 60]);
      return;
    }

    try {
      const result = await startLocationTracking(unitId);
      if (result.ok) {
        setTrackingActive(true);
        Vibration.vibrate(100);
        // Emit initial position immediately so the web map shows the pin on start
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setCurrentCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          await unitsApi.updateLocation(unitId, loc.coords.latitude, loc.coords.longitude);
          setGpsCount(1);
        } catch { /* initial fix is best-effort */ }
        return;
      }

      // Surface *why* tracking failed so the officer can fix it themselves
      // instead of tapping a silent button.
      if (result.reason === 'foreground_denied') {
        Alert.alert(
          'Permiso de ubicación denegado',
          'Ve a Ajustes → Velnari Field → Ubicación y elige "Siempre" o "Al usar la app".',
        );
      } else if (result.reason === 'background_denied') {
        Alert.alert(
          'Permiso "Siempre" requerido',
          'Para que el centro de mando te vea cuando la app esté en segundo plano, necesitas "Siempre" en Ajustes → Velnari Field → Ubicación.',
        );
      } else {
        Alert.alert(
          'No se pudo iniciar GPS',
          result.error ?? 'Error desconocido al iniciar el tracking. Cierra y abre la app e intenta de nuevo.',
        );
      }
    } catch (err) {
      Alert.alert('Error', (err as Error).message ?? 'Falló la activación de GPS.');
    }
  }

  async function handleSendNote() {
    if (!assignedIncident || !noteText.trim()) return;
    setSendingNote(true);
    try {
      await incidentsApi.addNote(assignedIncident.id, noteText.trim());
      setNoteText('');
      Alert.alert('Nota enviada', 'Tu nota fue registrada en el incidente.');
    } catch {
      Alert.alert('Error', 'No se pudo enviar la nota.');
    } finally {
      setSendingNote(false);
    }
  }

  const RESOLUTION_OPTIONS = [
    { label: 'Resuelto', value: 'resolved' },
    { label: 'Falsa alarma', value: 'false_alarm' },
    { label: 'Transferido a otra unidad', value: 'transferred' },
  ];

  async function handleCloseIncident() {
    if (!assignedIncident) return;

    Alert.alert(
      'Cerrar incidente',
      `¿Cómo se resolvió ${assignedIncident.folio}?`,
      [
        ...RESOLUTION_OPTIONS.map((opt) => ({
          text: opt.label,
          onPress: async () => {
            setClosingIncident(true);
            try {
              await incidentsApi.close(assignedIncident.id, opt.value);
              setAssignedIncident(null);
              // Strong 3-pulse pattern so officer knows the finalization
              // went through even if they can't check the screen immediately.
              Vibration.vibrate([0, 150, 80, 150, 80, 150]);
              Alert.alert('Incidente cerrado', `${assignedIncident.folio} marcado como "${opt.label}".`);
            } catch {
              Alert.alert('Error', 'No se pudo cerrar el incidente. Intenta de nuevo.');
            } finally {
              setClosingIncident(false);
            }
          },
        })),
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  }

  async function handleAcceptPatrol(patrolId: string) {
    setAcceptingPatrol(true);
    try {
      await patrolsApi.accept(patrolId);
      Vibration.vibrate(100);
      // Refresh patrol data
      if (unitId) {
        const patrolsRes = await patrolsApi.getForUnit(unitId);
        const scheduled = patrolsRes.data.filter((p) => p.status === 'scheduled');
        const active = patrolsRes.data.find((p) => p.status === 'active') ?? null;
        setPendingPatrols(scheduled);
        setActivePatrol(active);
      }
      // Auto-start GPS tracking
      if (unitId && !trackingActive) {
        const result = await startLocationTracking(unitId);
        if (result.ok) {
          setTrackingActive(true);
          try {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            setCurrentCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            await unitsApi.updateLocation(unitId, loc.coords.latitude, loc.coords.longitude);
            setGpsCount(1);
          } catch { /* ignore */ }
        }
      }
      Alert.alert('Patrullaje aceptado', 'Tu patrullaje ha iniciado. El GPS se activó automáticamente.');
    } catch {
      Alert.alert('Error', 'No se pudo aceptar el patrullaje.');
    } finally {
      setAcceptingPatrol(false);
    }
  }

  const currentStatusOption = STATUS_OPTIONS.find((s) => s.value === status);

  async function handleTakePhoto() {
    if (!assignedIncident || takingPhoto) return;
    setTakingPhoto(true);
    try {
      const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (camStatus !== 'granted') {
        Alert.alert('Permiso denegado', 'Se necesita acceso a la cámara.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets[0]) return;
      const uri = result.assets[0].uri;
      try {
        await incidentsApi.uploadPhotoPresigned(assignedIncident.id, uri);
        Vibration.vibrate(100);
        Alert.alert('Foto enviada', 'La foto fue adjuntada al incidente.');
      } catch {
        try {
          await enqueuePhoto(assignedIncident.id, uri);
          Alert.alert('Sin conexión', 'La foto se guardó y se enviará cuando haya red.');
        } catch {
          Alert.alert('Error', 'No se pudo guardar la foto. Intenta de nuevo.');
        }
      }
    } finally {
      setTakingPhoto(false);
    }
  }

  async function handlePanic() {
    // Guard: ignore if an alert is already in flight (prevents double-submit when
    // the long-press retriggers or the user releases and re-presses quickly).
    if (sendingPanic) return;
    setSendingPanic(true);
    Vibration.vibrate([0, 500, 200, 500]);
    try {
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus !== 'granted') {
        Alert.alert('Error', 'Se necesitan permisos de ubicación para el botón de pánico.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await incidentsApi.create({
        type: 'other',
        priority: 'critical',
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        description: `🚨 ALERTA DE PÁNICO — ${callSign ?? 'Unidad'} en peligro. Requiere apoyo inmediato.`,
        address: `GPS: ${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`,
      });
      Alert.alert('🚨 Alerta enviada', 'Tu ubicación y alerta fueron enviadas al centro de mando.');
    } catch (err: unknown) {
      const isNetworkError = !(err as { response?: unknown }).response;
      if (isNetworkError) {
        // Try fresh GPS → fallback to last known → refuse to enqueue without coords
        let lat: number | null = null;
        let lng: number | null = null;
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        } catch {
          try {
            const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
            if (last) { lat = last.coords.latitude; lng = last.coords.longitude; }
          } catch { /* no-op */ }
        }

        if (lat == null || lng == null) {
          // Critical: do NOT queue a panic alert without coordinates — operators need location.
          Alert.alert(
            '⚠️ Sin GPS',
            'No se pudo obtener tu ubicación. Activa el GPS y vuelve a intentar. Si estás en peligro, usa radio.',
            [{ text: 'Entendido', style: 'default' }],
          );
          return;
        }

        await enqueue('post', '/incidents', {
          type: 'other',
          priority: 'critical',
          lat,
          lng,
          description: `🚨 ALERTA DE PÁNICO — ${callSign ?? 'Unidad'} en peligro. Requiere apoyo inmediato.`,
          address: `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        });
        Vibration.vibrate([0, 200, 100, 200]);
        Alert.alert(
          '🚨 Alerta guardada',
          'Sin conexión. La alerta se enviará al centro de mando cuando haya red.',
          [{ text: 'Entendido', style: 'default' }],
        );
      } else {
        Alert.alert('Error', 'No se pudo enviar la alerta. Intenta de nuevo.');
      }
    } finally {
      setSendingPanic(false);
    }
  }

  return (
    <View style={styles.rootContainer}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor="#3B82F6"
          onRefresh={async () => {
            setRefreshing(true);
            await loadUnitAndIncident();
            setRefreshing(false);
          }}
        />
      }
    >
      {/* Unit header with SOS icon — long-press to trigger panic alert.
          Kept visually minimal on purpose; a pulsing red icon is enough
          affordance without eating screen real estate. */}
      <View style={styles.unitCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.callSign}>{callSign ?? 'Sin unidad'}</Text>
          <Text style={styles.userName}>{user?.name}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: (currentStatusOption?.color ?? '#64748B') + '22' }]}>
          <Text style={[styles.statusText, { color: currentStatusOption?.color ?? '#64748B' }]}>
            {currentStatusOption?.icon} {currentStatusOption?.label ?? status}
          </Text>
        </View>
        {unitId && (
          <TouchableOpacity
            onPressIn={() => {
              // Mid-press haptic at 500ms so the officer knows the hold is
              // registered. Confirms only at 1500ms — prevents accidental
              // fires from a glove brush or holster bump.
              const halfway = setTimeout(() => Vibration.vibrate(80), 500);
              // Store the timer so we can clear it on pressOut.
              (globalThis as unknown as { __sosHapticTimer?: ReturnType<typeof setTimeout> }).__sosHapticTimer = halfway;
            }}
            onPressOut={() => {
              const t = (globalThis as unknown as { __sosHapticTimer?: ReturnType<typeof setTimeout> }).__sosHapticTimer;
              if (t) clearTimeout(t);
            }}
            onLongPress={handlePanic}
            delayLongPress={1500}
            hitSlop={20}
            disabled={sendingPanic}
            style={[styles.sosIconButton, sendingPanic && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel="Botón de pánico SOS"
            accessibilityHint="Mantén presionado 1.5 segundos para enviar alerta crítica al centro de mando"
          >
            <Animated.View
              style={[
                styles.sosIconGlow,
                {
                  opacity: pulseAnim.interpolate({ inputRange: [0.3, 1], outputRange: [0.3, 0.8] }),
                },
              ]}
            />
            <Text style={styles.sosIconText}>{sendingPanic ? '…' : 'SOS'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* GPS tracking — big prominent button */}
      <TouchableOpacity
        style={[styles.gpsButton, trackingActive && styles.gpsButtonActive]}
        onPress={toggleTracking}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={trackingActive ? 'Detener rastreo GPS' : 'Iniciar rastreo GPS'}
        accessibilityHint="Activa o desactiva el envío de tu ubicación al centro de mando"
      >
        <Text style={styles.gpsIcon}>{trackingActive ? '📡' : '📍'}</Text>
        <View>
          <Text style={[styles.gpsTitle, trackingActive && styles.gpsTitleActive]}>
            {trackingActive ? 'GPS ACTIVO' : 'INICIAR RASTREO'}
          </Text>
          {trackingActive ? (
            <Text style={styles.gpsSubtitle}>
              {gpsCount} puntos enviados · Toca para detener
            </Text>
          ) : (
            <Text style={styles.gpsSubtitle}>
              Tu ubicación se enviará al centro de mando
            </Text>
          )}
        </View>
        {trackingActive && <View style={styles.gpsPulse} />}
      </TouchableOpacity>

      {/* Coordinates readout */}
      {trackingActive && currentCoords && (
        <TouchableOpacity
          style={styles.coordsBar}
          onPress={async () => {
            try {
              await Clipboard.setStringAsync(
                `${currentCoords.lat.toFixed(5)}, ${currentCoords.lng.toFixed(5)}`,
              );
              Vibration.vibrate(40);
              Alert.alert('Copiado', 'Coordenadas copiadas al portapapeles.');
            } catch {
              // expo-clipboard may not be installed — silently skip
            }
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Copiar coordenadas al portapapeles"
        >
          <Text style={styles.coordsText}>
            📍 {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
          </Text>
          <Text style={styles.coordsHint}>Toca para copiar</Text>
        </TouchableOpacity>
      )}

      {/* Active patrol */}
      {activePatrol && (
        <>
          <Text style={styles.sectionLabel}>Patrullaje activo</Text>
          <View style={styles.patrolCardActive}>
            <View style={styles.patrolHeader}>
              <Text style={styles.patrolSector}>
                {activePatrol.sector?.name ?? 'Sector'}
              </Text>
              <View style={styles.patrolBadgeActive}>
                <Text style={styles.patrolBadgeActiveText}>EN CURSO</Text>
              </View>
            </View>
            <Text style={styles.patrolTime}>
              {new Date(activePatrol.startAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              {' — '}
              {new Date(activePatrol.endAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {activePatrol.acceptedAt && (
              <Text style={styles.patrolAccepted}>
                Aceptado: {new Date(activePatrol.acceptedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>
        </>
      )}

      {/* Pending patrols */}
      {pendingPatrols.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Patrullajes pendientes</Text>
          {pendingPatrols.map((patrol) => (
            <View key={patrol.id} style={styles.patrolCardPending}>
              <View style={styles.patrolHeader}>
                <Text style={styles.patrolSector}>
                  {patrol.sector?.name ?? 'Sector'}
                </Text>
                <View style={styles.patrolBadgePending}>
                  <Text style={styles.patrolBadgePendingText}>PROGRAMADO</Text>
                </View>
              </View>
              <Text style={styles.patrolTime}>
                {new Date(patrol.startAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                {' — '}
                {new Date(patrol.endAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <TouchableOpacity
                style={[styles.acceptButton, acceptingPatrol && styles.acceptButtonDisabled]}
                onPress={() => handleAcceptPatrol(patrol.id)}
                disabled={acceptingPatrol}
                activeOpacity={0.7}
              >
                <Text style={styles.acceptButtonText}>
                  {acceptingPatrol ? 'Aceptando...' : 'Aceptar e iniciar'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* Status selector */}
      <Text style={styles.sectionLabel}>Estado de la unidad</Text>
      <View style={styles.statusGrid}>
        {STATUS_OPTIONS.map((opt) => {
          const isActive = status === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.statusOption,
                isActive && { borderColor: opt.color, backgroundColor: opt.color + '22' },
              ]}
              onPress={() => handleStatusChange(opt.value)}
              activeOpacity={0.7}
            >
              <View style={[styles.statusIconCircle, { backgroundColor: opt.color + '33', borderColor: opt.color }]}>
                <Text style={[styles.statusOptionIcon, { color: opt.color }]}>{opt.icon}</Text>
              </View>
              <Text style={[styles.statusOptionText, isActive && { color: opt.color, fontWeight: '700' }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Assigned incident */}
      <Text style={styles.sectionLabel}>Incidente asignado</Text>
      {assignedIncident ? (
        <>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setDetailIncidentId(assignedIncident.id)}
          style={[styles.incidentCard, { borderLeftColor: PRIORITY_COLORS[assignedIncident.priority] ?? '#F59E0B' }]}
        >
          <View style={styles.incidentHeader}>
            <Text style={styles.incidentFolio}>{assignedIncident.folio}</Text>
            <View style={[styles.priorityBadge, { backgroundColor: (PRIORITY_COLORS[assignedIncident.priority] ?? '#F59E0B') + '22' }]}>
              <Text style={[styles.priorityText, { color: PRIORITY_COLORS[assignedIncident.priority] ?? '#F59E0B' }]}>
                {assignedIncident.priority.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.incidentType}>
            {TYPE_LABELS[assignedIncident.type] ?? assignedIncident.type}
          </Text>
          {assignedIncident.address ? (
            <Text style={styles.incidentAddress}>📍 {assignedIncident.address}</Text>
          ) : null}
          {assignedIncident.description ? (
            <Text style={styles.incidentDesc}>{assignedIncident.description}</Text>
          ) : null}
          <Text style={styles.incidentTapHint}>Toca para ver detalle, línea de tiempo y adjuntos →</Text>
        </TouchableOpacity>

        {/* Note input */}
        <View style={styles.noteContainer}>
          <View style={styles.noteInputRow}>
            <TextInput
              style={styles.noteInput}
              placeholder="Agregar nota... (usa 🎤 del teclado para dictar)"
              placeholderTextColor="#64748B"
              value={noteText}
              onChangeText={setNoteText}
              multiline
              editable={!sendingNote}
            />
          </View>
          <View style={styles.noteActions}>
            <TouchableOpacity
              style={[styles.cameraButton, takingPhoto && { opacity: 0.6 }]}
              onPress={handleTakePhoto}
              disabled={takingPhoto}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Adjuntar foto al incidente"
              accessibilityHint="Abre la cámara para tomar una foto y adjuntarla al incidente actual"
            >
              <Text style={styles.cameraButtonText}>{takingPhoto ? '⏳' : '📷'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.noteButton, styles.noteButtonFlex, (!noteText.trim() || sendingNote) && styles.noteButtonDisabled]}
              onPress={handleSendNote}
              disabled={!noteText.trim() || sendingNote}
              activeOpacity={0.7}
            >
              <Text style={styles.noteButtonText}>{sendingNote ? 'Enviando...' : 'Enviar'}</Text>
            </TouchableOpacity>
          </View>
          {/* Voice note — push-and-hold record, release to upload */}
          <View style={{ marginTop: 10 }}>
            <VoiceNoteButton incidentId={assignedIncident.id} />
          </View>
        </View>

        {/* Close incident button */}
        {(assignedIncident.status === 'assigned' || assignedIncident.status === 'on_scene') && (
          <TouchableOpacity
            style={[styles.closeIncidentButton, closingIncident && styles.closeIncidentButtonDisabled]}
            onPress={handleCloseIncident}
            disabled={closingIncident}
            activeOpacity={0.7}
          >
            <Text style={styles.closeIncidentButtonText}>
              {closingIncident ? 'FINALIZANDO…' : '⚠ FINALIZAR INCIDENTE'}
            </Text>
          </TouchableOpacity>
        )}
        </>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>✓</Text>
          <Text style={styles.emptyText}>Disponible para despacho</Text>
          <Text style={styles.emptySubtext}>
            El centro de mando te asignará el siguiente incidente.{'\n'}
            Desliza hacia abajo para refrescar.
          </Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>

    <IncidentDetailModal
      incidentId={detailIncidentId}
      onClose={() => setDetailIncidentId(null)}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: { flex: 1, backgroundColor: '#0F172A' },
  container: { flex: 1, backgroundColor: '#0F172A' },
  scrollContent: { padding: 16 },

  // Unit card — card elevation for depth
  unitCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 18, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 5 },
  callSign: { color: '#F8FAFC', fontSize: 26, fontWeight: '800', letterSpacing: 1 },
  userName: { color: '#94A3B8', fontSize: 14, marginTop: 2 },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 14, fontWeight: '600' },

  // GPS button — enlarged for glove-friendliness (min 56px height)
  gpsButton: { backgroundColor: '#1E293B', borderWidth: 2, borderColor: '#334155', borderRadius: 14, paddingVertical: 18, paddingHorizontal: 18, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72 },
  gpsButtonActive: { borderColor: '#22C55E', backgroundColor: '#052e16' },
  gpsIcon: { fontSize: 32 },
  gpsTitle: { color: '#94A3B8', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  gpsTitleActive: { color: '#22C55E' },
  gpsSubtitle: { color: '#64748B', fontSize: 13, marginTop: 2 },
  gpsPulse: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', marginLeft: 'auto' },

  // Coords bar
  coordsBar: {
    backgroundColor: '#1E293B', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#334155',
  },
  // 16pt so coords are readable in sunlight; dropped monospace in favor of
  // the default variable font which renders cleaner at small sizes.
  coordsText: { color: '#60A5FA', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  coordsHint: { color: '#64748B', fontSize: 10, marginTop: 2, letterSpacing: 0.5 },

  // Section
  sectionLabel: { color: '#64748B', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, marginTop: 10 },

  // Status grid — 48px min height touch targets for gloves
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statusOption: { borderWidth: 1.5, borderColor: '#334155', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, width: '47%' as unknown as number, minHeight: 52 },
  statusIconCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  statusOptionIcon: { fontSize: 16, fontWeight: '800' },
  statusOptionText: { color: '#94A3B8', fontSize: 14, fontWeight: '500' },

  // Incident card — more padding, larger text, card elevation
  incidentCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 20, marginBottom: 24, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  incidentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  incidentFolio: { color: '#F8FAFC', fontWeight: '800', fontSize: 20, fontFamily: 'monospace' },
  priorityBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  priorityText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  incidentType: { color: '#F8FAFC', fontSize: 17, fontWeight: '600', marginBottom: 8 },
  incidentAddress: { color: '#94A3B8', fontSize: 15, marginBottom: 6 },
  incidentDesc: { color: '#64748B', fontSize: 14, marginTop: 6, lineHeight: 20 },
  incidentTapHint: { color: '#475569', fontSize: 11, marginTop: 10, fontStyle: 'italic' },

  // Note input — larger touch targets for gloves
  noteContainer: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, marginTop: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  noteInputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noteInput: { flex: 1, backgroundColor: '#0F172A', borderRadius: 12, padding: 14, color: '#F8FAFC', fontSize: 16, minHeight: 72, textAlignVertical: 'top', marginBottom: 10 },
  noteActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  cameraButton: { backgroundColor: '#334155', borderRadius: 12, minWidth: 52, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  cameraButtonText: { fontSize: 24 },
  noteButton: { backgroundColor: '#3B82F6', borderRadius: 12, paddingVertical: 14, alignItems: 'center', minHeight: 48 },
  noteButtonFlex: { flex: 1 },
  noteButtonDisabled: { opacity: 0.4 },
  noteButtonText: { color: '#F8FAFC', fontWeight: '700', fontSize: 16 },

  // Empty
  emptyCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 32, alignItems: 'center' },
  emptyIcon: { fontSize: 24, color: '#22C55E', marginBottom: 8 },
  emptyText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  emptySubtext: { color: '#475569', fontSize: 12, marginTop: 4 },

  // Patrol cards
  patrolCardActive: { backgroundColor: '#1E293B', borderRadius: 14, padding: 18, marginBottom: 14, borderWidth: 2, borderColor: '#22C55E', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 5 },
  patrolCardPending: { backgroundColor: '#1E293B', borderRadius: 14, padding: 18, marginBottom: 10, borderWidth: 2, borderColor: '#F59E0B', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 5 },
  patrolHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  patrolSector: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  patrolBadgeActive: { backgroundColor: '#22C55E22', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  patrolBadgeActiveText: { color: '#22C55E', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  patrolBadgePending: { backgroundColor: '#F59E0B22', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  patrolBadgePendingText: { color: '#F59E0B', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  // Non-monospace + numberOfLines=1 via parent prevents midnight-crossing
  // times from wrapping unexpectedly. Tabular-nums keeps hours aligned.
  patrolTime: { color: '#CBD5E1', fontSize: 15, fontWeight: '600', marginBottom: 4, fontVariant: ['tabular-nums'] },
  patrolAccepted: { color: '#64748B', fontSize: 13, marginTop: 2 },
  acceptButton: { backgroundColor: '#F59E0B', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12, minHeight: 48 },
  acceptButtonDisabled: { opacity: 0.4 },
  acceptButtonText: { color: '#0F172A', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },

  // Close incident button — amber so it reads as "caution: finalizing"
  // rather than "available/ready" (which is the green status color).
  closeIncidentButton: {
    backgroundColor: '#78350F',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    minHeight: 52,
  },
  closeIncidentButtonDisabled: {
    opacity: 0.5,
  },
  closeIncidentButtonText: {
    color: '#FCD34D',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // SOS icon in header — minimal footprint. Long-press to activate; the
  // pulsing red glow behind it is the affordance that this is live/urgent.
  sosIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginLeft: 10,
    backgroundColor: '#7F1D1D',
    borderWidth: 2,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  sosIconGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 24,
    backgroundColor: '#EF4444',
  },
  sosIconText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    zIndex: 1,
  },
});
