# Mobile Offline Resilience + Photo Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give field officers offline-safe photo capture in the report screen, persist GPS location points during connectivity loss with dedup/batching on reconnect, and wire all offline queues to flush automatically when the network returns.

**Architecture:** Three concerns are cleanly separated: (1) `photo-queue.ts` owns offline photo storage — copies temp URIs to permanent app storage, queues them, and uploads on reconnect; (2) `location-queue.ts` owns GPS buffering — deduplicates to 1 point/min, caps at 20 points, flushes oldest-first on reconnect; (3) `report.tsx` gets a photo attachment section using the existing `expo-image-picker` package. All flush calls converge in `home.tsx`'s existing reconnect/load path.

**Tech Stack:** React Native, Expo SDK 52, expo-file-system (new), expo-image-picker (already installed), @react-native-async-storage/async-storage (already installed), expo-secure-store (already installed)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `apps/mobile/package.json` | Add expo-file-system dependency |
| Create | `apps/mobile/src/lib/photo-queue.ts` | Offline photo persistence (copy URI → documents dir, queue, flush) |
| Create | `apps/mobile/src/lib/location-queue.ts` | GPS point buffer (dedup 1/min, cap 20, flush sequential) |
| Modify | `apps/mobile/src/lib/location.ts` | On updateLocation failure → storeLocationPoint instead of silent drop |
| Modify | `apps/mobile/app/(tabs)/report.tsx` | Photo picker section + offline photo enqueue after incident creation |
| Modify | `apps/mobile/app/(tabs)/home.tsx` | Fix handleTakePhoto offline path + flush photo/location queues on load |

---

## Task 1: Install expo-file-system + Create photo-queue.ts

**Files:**
- Modify: `apps/mobile/package.json`
- Create: `apps/mobile/src/lib/photo-queue.ts`

- [ ] **Step 1: Add expo-file-system to package.json**

Read `apps/mobile/package.json`. In the `dependencies` object, add after `expo-device`:

```json
"expo-file-system": "~18.0.0",
```

- [ ] **Step 2: Install the dependency**

```bash
cd /Users/Ivan/Desktop/velnari-police && pnpm install
```

Expected output: `Packages: +N added`. If version conflicts, try `"expo-file-system": "*"` and let Expo SDK resolve it.

- [ ] **Step 3: Create photo-queue.ts**

Create `apps/mobile/src/lib/photo-queue.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const QUEUE_KEY = 'velnari_photo_queue';
const PHOTOS_DIR = `${FileSystem.documentDirectory}velnari_photos/`;

interface QueuedPhoto {
  id: string;
  incidentId: string;
  localUri: string;
  capturedAt: string;
}

async function loadQueue(): Promise<QueuedPhoto[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedPhoto[]) : [];
  } catch { return []; }
}

async function saveQueue(queue: QueuedPhoto[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Copies a temp image URI to permanent app storage and queues it for upload.
 * Call this when the network is unavailable or after incident creation completes.
 */
export async function enqueuePhoto(incidentId: string, tempUri: string): Promise<void> {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ext = tempUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const destUri = `${PHOTOS_DIR}${id}.${ext}`;

  // Ensure permanent directory exists
  await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  // Copy from temp location (picker URI) to permanent storage
  await FileSystem.copyAsync({ from: tempUri, to: destUri });

  const queue = await loadQueue();
  queue.push({ id, incidentId, localUri: destUri, capturedAt: new Date().toISOString() });
  await saveQueue(queue);
}

/**
 * Uploads all queued photos. Returns counts.
 * Stops on first network failure (still offline) to avoid hammering the server.
 */
export async function flushPhotoQueue(): Promise<{ success: number; failed: number }> {
  const queue = await loadQueue();
  if (queue.length === 0) return { success: 0, failed: 0 };

  // Lazy import to break circular dep (api -> photo-queue -> api)
  const { incidentsApi } = require('./api') as typeof import('./api');

  let success = 0;
  let failed = 0;
  const remaining: QueuedPhoto[] = [];

  for (const photo of queue) {
    // Verify file still exists (could have been cleared)
    const info = await FileSystem.getInfoAsync(photo.localUri);
    if (!info.exists) {
      // File gone — remove from queue silently
      continue;
    }
    try {
      await incidentsApi.uploadPhoto(photo.incidentId, photo.localUri);
      // Delete local copy after successful upload
      await FileSystem.deleteAsync(photo.localUri, { idempotent: true });
      success++;
    } catch {
      remaining.push(photo);
      failed++;
      // Stop attempting — still offline
      break;
    }
  }

  // Keep all remaining photos that weren't attempted yet
  const attemptedIds = new Set(queue.slice(0, queue.length - remaining.length).map((p) => p.id));
  const notAttempted = queue.filter((p) => !attemptedIds.has(p.id) && remaining.every((r) => r.id !== p.id));
  await saveQueue([...remaining, ...notAttempted]);
  return { success, failed };
}

export async function getPhotoQueueSize(): Promise<number> {
  const queue = await loadQueue();
  return queue.length;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Ivan/Desktop/velnari-police/apps/mobile && ../../node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors. If `expo-file-system` types are missing, run `pnpm install` again from the monorepo root.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/package.json apps/mobile/src/lib/photo-queue.ts pnpm-lock.yaml
git commit -m "feat(mobile): offline photo queue — copy to permanent storage, flush on reconnect"
```

---

## Task 2: Create location-queue.ts + Update location.ts

**Files:**
- Create: `apps/mobile/src/lib/location-queue.ts`
- Modify: `apps/mobile/src/lib/location.ts`

- [ ] **Step 1: Create location-queue.ts**

Create `apps/mobile/src/lib/location-queue.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'velnari_location_queue';
const MAX_POINTS = 20;         // Max buffered points — oldest dropped when exceeded
const DEDUP_WINDOW_MS = 60_000; // Keep at most 1 point per 60-second window

interface LocationPoint {
  unitId: string;
  lat: number;
  lng: number;
  timestamp: number;
}

async function loadQueue(): Promise<LocationPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as LocationPoint[]) : [];
  } catch { return []; }
}

async function saveQueue(queue: LocationPoint[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Stores a GPS point captured while offline.
 * Deduplication: replaces the last point if it falls within the same 60s window.
 * Caps total buffered points at MAX_POINTS (drops oldest).
 */
export async function storeLocationPoint(unitId: string, lat: number, lng: number): Promise<void> {
  const queue = await loadQueue();
  const now = Date.now();
  const last = queue[queue.length - 1];

  if (last && now - last.timestamp < DEDUP_WINDOW_MS) {
    // Replace the last point — we only need one sample per minute
    queue[queue.length - 1] = { unitId, lat, lng, timestamp: now };
  } else {
    queue.push({ unitId, lat, lng, timestamp: now });
  }

  // Trim to MAX_POINTS keeping the most recent
  const trimmed = queue.slice(-MAX_POINTS);
  await saveQueue(trimmed);
}

/**
 * Sends all buffered location points to the API in chronological order.
 * Stops at first failure (still offline). Removes sent points from the queue.
 */
export async function flushLocationQueue(): Promise<{ sent: number }> {
  const queue = await loadQueue();
  if (queue.length === 0) return { sent: 0 };

  // Lazy import
  const { unitsApi } = require('./api') as typeof import('./api');

  let sent = 0;
  const remaining: LocationPoint[] = [];

  for (const point of queue) {
    try {
      await unitsApi.updateLocation(point.unitId, point.lat, point.lng);
      sent++;
    } catch {
      // Still offline — keep this and all subsequent points
      remaining.push(...queue.slice(queue.indexOf(point)));
      break;
    }
  }

  await saveQueue(remaining);
  return { sent };
}

export async function getLocationQueueSize(): Promise<number> {
  const queue = await loadQueue();
  return queue.length;
}
```

- [ ] **Step 2: Update location.ts to buffer failed GPS points**

Read `apps/mobile/src/lib/location.ts`. The background task currently silently drops failed `updateLocation` calls. Replace the silent-fail catch with a buffer call.

Find this block (around line 24-27):
```typescript
  try {
    await unitsApi.updateLocation(_unitId, latitude, longitude, batteryLevel);
  } catch {
    // silently fail — will retry on next ping
  }
```

Replace it with:
```typescript
  try {
    await unitsApi.updateLocation(_unitId, latitude, longitude, batteryLevel);
  } catch {
    // Buffer the point for sync when network returns
    try {
      const { storeLocationPoint } = require('./location-queue') as typeof import('./location-queue');
      await storeLocationPoint(_unitId, latitude, longitude);
    } catch { /* storage unavailable — truly nothing we can do */ }
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/Ivan/Desktop/velnari-police/apps/mobile && ../../node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/location-queue.ts apps/mobile/src/lib/location.ts
git commit -m "feat(mobile): GPS location buffering — dedup 1/min, cap 20 points, flush on reconnect"
```

---

## Task 3: Photo Attachment UI in report.tsx

**Files:**
- Modify: `apps/mobile/app/(tabs)/report.tsx`

The `report.tsx` screen lets officers create new incidents. After the incident is created we have an `id` — we then upload photos to that `id`. If the network fails during upload, we enqueue to `photo-queue.ts` using the incident `id` just created. If the network fails during incident _creation_ (already handled by offline-queue JSON queue), photos stay in a pending state — we need to warn the user that photos will be lost in that case (incident creation queued as JSON means we don't have an `id` yet, so we can't queue photos against it). For the MVP: block photo upload if incident creation itself failed, show a clear message.

`expo-image-picker` is already installed. Import it.

- [ ] **Step 1: Rewrite report.tsx with photo attachment section**

Replace the entire content of `apps/mobile/app/(tabs)/report.tsx` with:

```typescript
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
  const [photos, setPhotos] = useState<string[]>([]); // local URIs

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
              setPhotos((prev) => [...prev, result.assets[0]!.uri]);
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
              setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
            }
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  }

  function removePhoto(uri: string) {
    setPhotos((prev) => prev.filter((p) => p !== uri));
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
      let photosQueued = 0;
      for (const uri of photos) {
        try {
          await incidentsApi.uploadPhoto(incidentId, uri);
        } catch {
          // Network unavailable — queue for later
          await enqueuePhoto(incidentId, uri);
          photosQueued++;
        }
      }

      setSuccess(res.data.folio);
      setType('');
      setPriority('');
      setAddress('');
      setDescription('');
      setCoords(null);
      setPhotos([]);

      if (photosQueued > 0) {
        Alert.alert(
          'Incidente creado',
          `${photosQueued} foto(s) se subirán cuando haya conexión.`,
        );
      }

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
          {photos.map((uri) => (
            <View key={uri} style={styles.photoThumb}>
              <Image source={{ uri }} style={styles.thumbImage} />
              <TouchableOpacity
                style={styles.thumbRemove}
                onPress={() => removePhoto(uri)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.thumbRemoveText}>✕</Text>
              </TouchableOpacity>
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

  // Success
  successBanner: { backgroundColor: '#052e16', borderColor: '#22C55E', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 8, alignItems: 'center' },
  successText: { color: '#22C55E', fontWeight: '700', fontSize: 14 },
  successSubtext: { color: '#4ade80', fontSize: 11, marginTop: 2 },

  // Location
  locationButton: { backgroundColor: '#1E293B', borderWidth: 2, borderColor: '#334155', borderRadius: 14, padding: 20, marginBottom: 10, minHeight: 72, justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  locationButtonDone: { borderColor: '#3B82F6', backgroundColor: '#0F172A' },
  locationContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  locationIcon: { fontSize: 28 },
  locationCoords: { color: '#3B82F6', fontSize: 15, fontFamily: 'monospace', fontWeight: '700' },
  locationPlaceholder: { color: '#94A3B8', fontSize: 16, fontWeight: '600' },
  locationHint: { color: '#475569', fontSize: 13, marginTop: 2 },

  // Type
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeChip: { backgroundColor: '#1E293B', borderWidth: 1.5, borderColor: '#334155', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50 },
  typeChipActive: { borderColor: '#3B82F6', backgroundColor: '#1e3a5f' },
  typeIcon: { fontSize: 20 },
  typeLabel: { color: '#94A3B8', fontSize: 15 },
  typeLabelActive: { color: '#3B82F6', fontWeight: '700' },

  // Priority
  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityChip: { flex: 1, borderWidth: 1.5, borderColor: '#334155', borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, minHeight: 50 },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  priorityLabel: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },

  // Inputs
  input: { backgroundColor: '#1E293B', borderWidth: 1.5, borderColor: '#334155', borderRadius: 12, padding: 16, color: '#F8FAFC', fontSize: 16, minHeight: 52 },
  textArea: { height: 100, textAlignVertical: 'top', fontSize: 16, lineHeight: 22 },

  // Photos
  photoButton: { backgroundColor: '#1E293B', borderWidth: 1.5, borderColor: '#334155', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  photoButtonIcon: { fontSize: 22 },
  photoButtonText: { color: '#94A3B8', fontSize: 15, fontWeight: '600' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  photoThumb: { width: 88, height: 88, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  thumbImage: { width: '100%', height: '100%' },
  thumbRemove: { position: 'absolute', top: 4, right: 4, backgroundColor: '#0F172A', borderRadius: 12, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  thumbRemoveText: { color: '#EF4444', fontSize: 11, fontWeight: '700' },

  // Submit
  submitButton: { backgroundColor: '#3B82F6', borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 28, minHeight: 60, justifyContent: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  submitDisabled: { opacity: 0.4, shadowOpacity: 0 },
  submitText: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(tabs)/report.tsx
git commit -m "feat(mobile): photo attachment UI in report screen — camera/gallery, offline queue fallback"
```

---

## Task 4: Wire All Queue Flushes in home.tsx

**Files:**
- Modify: `apps/mobile/app/(tabs)/home.tsx`

The home screen already calls `flushQueue()` (JSON queue) on load. We need to also flush the photo queue and location queue. Additionally, `handleTakePhoto` (for photos on assigned incidents) should fall back to `enqueuePhoto` instead of showing a bare error alert when offline.

- [ ] **Step 1: Add imports to home.tsx**

Read `apps/mobile/app/(tabs)/home.tsx`. At the top, find the existing import line:
```typescript
import { flushQueue } from '@/lib/offline-queue';
```

Replace it with:
```typescript
import { flushQueue } from '@/lib/offline-queue';
import { flushPhotoQueue } from '@/lib/photo-queue';
import { flushLocationQueue } from '@/lib/location-queue';
```

- [ ] **Step 2: Wire photo + location flush into loadUnitAndIncident**

In `home.tsx`, find the `loadUnitAndIncident` function. It starts with:
```typescript
  const loadUnitAndIncident = useCallback(async () => {
    try {
      const flushed = await flushQueue();
      if (flushed.success > 0) {
        Alert.alert('Sincronizado', `${flushed.success} acciones pendientes enviadas.`);
      }
```

Replace those 4 lines with:
```typescript
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
```

- [ ] **Step 3: Fix handleTakePhoto to queue photos offline**

In `home.tsx`, find `handleTakePhoto`:
```typescript
  async function handleTakePhoto() {
    if (!assignedIncident) return;
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
    try {
      await incidentsApi.uploadPhoto(assignedIncident.id, result.assets[0].uri);
      Vibration.vibrate(100);
      Alert.alert('Foto enviada', 'La foto fue adjuntada al incidente.');
    } catch {
      Alert.alert('Error', 'No se pudo enviar la foto.');
    }
  }
```

Replace the entire function with:
```typescript
  async function handleTakePhoto() {
    if (!assignedIncident) return;
    const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (camStatus !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la cámara.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    try {
      await incidentsApi.uploadPhoto(assignedIncident.id, uri);
      Vibration.vibrate(100);
      Alert.alert('Foto enviada', 'La foto fue adjuntada al incidente.');
    } catch {
      // No network — queue for upload on reconnect
      try {
        const { enqueuePhoto } = require('@/lib/photo-queue') as typeof import('@/lib/photo-queue');
        await enqueuePhoto(assignedIncident.id, uri);
        Alert.alert('Sin conexión', 'La foto se guardó y se enviará cuando haya red.');
      } catch {
        Alert.alert('Error', 'No se pudo guardar la foto. Intenta de nuevo.');
      }
    }
  }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Ivan/Desktop/velnari-police/apps/mobile && ../../node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(tabs)/home.tsx
git commit -m "feat(mobile): flush photo + GPS queues on reconnect, offline fallback in handleTakePhoto"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Photo UI in report screen (camera + gallery, thumbnails, remove) | Task 3 |
| Photos upload online after incident creation | Task 3 |
| Photos queued offline (permanent URI, flush on reconnect) | Task 1 + Task 3 |
| GPS location buffered when offline (dedup 1/min, cap 20) | Task 2 |
| Location points flushed on reconnect | Task 2 + Task 4 |
| handleTakePhoto (home.tsx) queues offline | Task 4 |
| All flushes fire together on app load/reconnect | Task 4 |

**Placeholder scan:** None found. Every step has complete code.

**Type consistency check:**
- `enqueuePhoto(incidentId: string, uri: string)` — defined in Task 1, called in Task 3 and Task 4. ✅
- `flushPhotoQueue(): Promise<{ success: number; failed: number }>` — defined in Task 1, called in Task 4. ✅
- `storeLocationPoint(unitId: string, lat: number, lng: number)` — defined in Task 2, called in Task 2 (location.ts). ✅
- `flushLocationQueue(): Promise<{ sent: number }>` — defined in Task 2, called in Task 4. ✅
