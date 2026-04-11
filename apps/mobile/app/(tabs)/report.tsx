// apps/mobile/app/(tabs)/report.tsx
import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Alert, Vibration, ActivityIndicator, Image,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { incidentsApi } from '@/lib/api';
import { enqueuePhoto } from '@/lib/photo-queue';

const TYPES = [
  { value: 'robbery', label: 'Robo', icon: '💰' },
  { value: 'assault', label: 'Agresión', icon: '👊' },
  { value: 'traffic', label: 'Accidente vial', icon: '🚗' },
  { value: 'noise', label: 'Ruido', icon: '🔊' },
  { value: 'domestic', label: 'Violencia doméstica', icon: '🏠' },
  { value: 'missing_person', label: 'Persona desaparecida', icon: '🔍' },
  { value: 'other', label: 'Otro', icon: '📋' },
];

const PRIORITIES = [
  { value: 'critical', label: 'Crítica', color: '#EF4444' },
  { value: 'high', label: 'Alta', color: '#F97316' },
  { value: 'medium', label: 'Media', color: '#F59E0B' },
  { value: 'low', label: 'Baja', color: '#22C55E' },
];

export default function ReportScreen() {
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingGps, setLoadingGps] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  interface PhotoItem {
    uri: string;
    status: 'pending' | 'uploading' | 'done' | 'queued';
  }
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  async function getLocation() {
    setLoadingGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Activa los permisos de ubicación.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      Vibration.vibrate(50);
    } catch {
      Alert.alert('Error', 'No se pudo obtener la ubicación.');
    } finally {
      setLoadingGps(false);
    }
  }

  async function pickPhoto() {
    Alert.alert(
      'Adjuntar foto',
      'Elige una opción',
      [
        {
          text: 'Cámara',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permiso denegado', 'Activa la cámara en configuración.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
            if (!result.canceled && result.assets[0]) {
              setPhotos((prev) => [...prev, { uri: result.assets[0]!.uri, status: 'pending' }]);
            }
          },
        },
        {
          text: 'Galería',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permiso denegado', 'Activa el acceso a fotos en configuración.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              quality: 0.7,
              allowsMultipleSelection: true,
              selectionLimit: 5,
            });
            if (!result.canceled) {
              setPhotos((prev) => [...prev, ...result.assets.map((a) => ({ uri: a.uri, status: 'pending' as const }))]);
            }
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  }

  function removePhoto(uri: string) {
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  }

  async function handleSubmit() {
    if (!type) { Alert.alert('Selecciona un tipo de incidente'); return; }
    if (!priority) { Alert.alert('Selecciona la prioridad'); return; }
    if (!coords) { Alert.alert('Obtén la ubicación primero'); return; }

    setSubmitting(true);
    try {
      const res = await incidentsApi.create({
        type,
        priority,
        lat: coords.lat,
        lng: coords.lng,
        address: address.trim() || undefined,
        description: description.trim() || undefined,
      });

      const incidentId = res.data.id;
      Vibration.vibrate(200);

      // Upload photos — queue offline, upload online
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i]!;
        setPhotos((prev) => prev.map((p, idx) =>
          idx === i ? { ...p, status: 'uploading' } : p
        ));
        try {
          await incidentsApi.uploadPhoto(incidentId, photo.uri);
          setPhotos((prev) => prev.map((p, idx) =>
            idx === i ? { ...p, status: 'done' } : p
          ));
        } catch {
          await enqueuePhoto(incidentId, photo.uri);
          setPhotos((prev) => prev.map((p, idx) =>
            idx === i ? { ...p, status: 'queued' } : p
          ));
        }
      }

      setSuccess(res.data.folio);
      setType('');
      setPriority('');
      setAddress('');
      setDescription('');
      setCoords(null);
      setPhotos([]);

      setTimeout(() => setSuccess(null), 4000);
    } catch {
      Alert.alert('Error', 'No se pudo crear el incidente. Se enviará cuando haya conexión.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Success banner */}
      {success && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>✓ Incidente {success} creado</Text>
          <Text style={styles.successSubtext}>Visible en el centro de mando</Text>
        </View>
      )}

      {/* Location */}
      <Text style={styles.sectionLabel}>Ubicación</Text>
      <TouchableOpacity
        style={[styles.locationButton, coords && styles.locationButtonDone]}
        onPress={getLocation}
        activeOpacity={0.7}
        disabled={loadingGps}
      >
        {loadingGps ? (
          <ActivityIndicator color="#3B82F6" />
        ) : coords ? (
          <View style={styles.locationContent}>
            <Text style={styles.locationIcon}>📍</Text>
            <View>
              <Text style={styles.locationCoords}>
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </Text>
              <Text style={styles.locationHint}>Toca para actualizar</Text>
            </View>
          </View>
        ) : (
          <View style={styles.locationContent}>
            <Text style={styles.locationIcon}>📍</Text>
            <View>
              <Text style={styles.locationPlaceholder}>Obtener mi ubicación</Text>
              <Text style={styles.locationHint}>Se usará como punto del incidente</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Type */}
      <Text style={styles.sectionLabel}>Tipo de incidente</Text>
      <View style={styles.typeGrid}>
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.typeChip, type === t.value && styles.typeChipActive]}
            onPress={() => setType(t.value)}
            activeOpacity={0.7}
          >
            <Text style={styles.typeIcon}>{t.icon}</Text>
            <Text style={[styles.typeLabel, type === t.value && styles.typeLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Priority */}
      <Text style={styles.sectionLabel}>Prioridad</Text>
      <View style={styles.priorityRow}>
        {PRIORITIES.map((p) => (
          <TouchableOpacity
            key={p.value}
            style={[
              styles.priorityChip,
              priority === p.value && { borderColor: p.color, backgroundColor: p.color + '22' },
            ]}
            onPress={() => setPriority(p.value)}
            activeOpacity={0.7}
          >
            <View style={[styles.priorityDot, { backgroundColor: p.color }]} />
            <Text style={[
              styles.priorityLabel,
              priority === p.value && { color: p.color, fontWeight: '700' },
            ]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Address */}
      <Text style={styles.sectionLabel}>Dirección (opcional)</Text>
      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        placeholder="Calle, colonia…"
        placeholderTextColor="#475569"
      />

      {/* Description */}
      <Text style={styles.sectionLabel}>Descripción (opcional)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Detalles del incidente…"
        placeholderTextColor="#475569"
        multiline
        numberOfLines={3}
      />

      {/* Photos */}
      <Text style={styles.sectionLabel}>Fotos (opcional)</Text>
      <TouchableOpacity style={styles.photoButton} onPress={pickPhoto} activeOpacity={0.7}>
        <Text style={styles.photoButtonIcon}>📷</Text>
        <Text style={styles.photoButtonText}>
          {photos.length === 0 ? 'Adjuntar foto' : `${photos.length} foto(s) — agregar más`}
        </Text>
      </TouchableOpacity>

      {photos.length > 0 && (
        <View style={styles.photoGrid}>
          {photos.map((photo) => (
            <View key={photo.uri} style={styles.photoThumb}>
              <Image source={{ uri: photo.uri }} style={styles.photoImage} />
              <View style={styles.photoStatusOverlay}>
                {photo.status === 'uploading' && (
                  <ActivityIndicator size="small" color="#F8FAFC" />
                )}
                {photo.status === 'done' && (
                  <Text style={styles.photoStatusDone}>✓</Text>
                )}
                {photo.status === 'queued' && (
                  <Text style={styles.photoStatusQueued}>⏳</Text>
                )}
              </View>
              {photo.status === 'pending' && !submitting && (
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => removePhoto(photo.uri)}
                >
                  <Text style={styles.photoRemoveText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitButton, (!type || !priority || !coords || submitting) && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={!type || !priority || !coords || submitting}
        activeOpacity={0.7}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Reportar incidente</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', padding: 16 },

  sectionLabel: { color: '#64748B', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, marginTop: 20 },

  successBanner: { backgroundColor: '#052e16', borderColor: '#22C55E', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 8, alignItems: 'center' },
  successText: { color: '#22C55E', fontWeight: '700', fontSize: 14 },
  successSubtext: { color: '#4ade80', fontSize: 11, marginTop: 2 },

  locationButton: { backgroundColor: '#1E293B', borderWidth: 2, borderColor: '#334155', borderRadius: 14, padding: 20, marginBottom: 10, minHeight: 72, justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  locationButtonDone: { borderColor: '#3B82F6', backgroundColor: '#0F172A' },
  locationContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  locationIcon: { fontSize: 28 },
  locationCoords: { color: '#3B82F6', fontSize: 15, fontFamily: 'monospace', fontWeight: '700' },
  locationPlaceholder: { color: '#94A3B8', fontSize: 16, fontWeight: '600' },
  locationHint: { color: '#475569', fontSize: 13, marginTop: 2 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeChip: { backgroundColor: '#1E293B', borderWidth: 1.5, borderColor: '#334155', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50 },
  typeChipActive: { borderColor: '#3B82F6', backgroundColor: '#1e3a5f' },
  typeIcon: { fontSize: 20 },
  typeLabel: { color: '#94A3B8', fontSize: 15 },
  typeLabelActive: { color: '#3B82F6', fontWeight: '700' },

  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityChip: { flex: 1, borderWidth: 1.5, borderColor: '#334155', borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, minHeight: 50 },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  priorityLabel: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },

  input: { backgroundColor: '#1E293B', borderWidth: 1.5, borderColor: '#334155', borderRadius: 12, padding: 16, color: '#F8FAFC', fontSize: 16, minHeight: 52 },
  textArea: { height: 100, textAlignVertical: 'top', fontSize: 16, lineHeight: 22 },

  photoButton: { backgroundColor: '#1E293B', borderWidth: 1.5, borderColor: '#334155', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  photoButtonIcon: { fontSize: 22 },
  photoButtonText: { color: '#94A3B8', fontSize: 15, fontWeight: '600' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  photoThumb: { width: 80, height: 80, borderRadius: 10, overflow: 'hidden', position: 'relative', backgroundColor: '#1E293B' },
  photoImage: { width: 80, height: 80 },
  photoStatusOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  photoStatusDone: { color: '#22C55E', fontSize: 24, fontWeight: '800' },
  photoStatusQueued: { fontSize: 20 },
  photoRemove: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  photoRemoveText: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },

  submitButton: { backgroundColor: '#3B82F6', borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 28, minHeight: 60, justifyContent: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  submitDisabled: { opacity: 0.4, shadowOpacity: 0 },
  submitText: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
});
