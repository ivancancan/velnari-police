# SOS Offline Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the SOS panic button is pressed but the device is offline (network error), vibrate and show "Alerta guardada, se enviará cuando haya red" instead of the current generic error — so officers know the alert was locally queued, not silently dropped.

**Architecture:** `handlePanic()` in `home.tsx` already catches errors and shows a generic alert. We modify the catch block to: (1) attempt to enqueue the panic incident via `enqueue()` from `offline-queue`, (2) vibrate, (3) show a distinct offline-specific alert. We detect offline vs server error by checking if `error.response` is undefined (network error) or defined (server rejected).

**Tech Stack:** `expo-location`, `offline-queue.ts` (already imported), `Vibration`, `Alert`.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/mobile/app/(tabs)/home.tsx` | Modify | Update `handlePanic()` catch block to enqueue + show offline feedback |

---

### Task 1: Update handlePanic() to enqueue and show offline feedback

**Files:**
- Modify: `apps/mobile/app/(tabs)/home.tsx`

The current `handlePanic()` in `home.tsx` (around line 248):

```typescript
async function handlePanic() {
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
  } catch {
    Alert.alert('Error', 'No se pudo enviar la alerta. Intenta de nuevo.');
  }
}
```

The catch block needs to:
1. Try to get location (best effort — may already have it from the try block above if the error happened after `getCurrentPositionAsync`)
2. Enqueue the panic incident for later sync
3. Vibrate (short confirmation pulse)
4. Show offline-specific alert

- [ ] **Step 1: Read home.tsx to confirm exact code at handlePanic**

Read `apps/mobile/app/(tabs)/home.tsx` lines 248–270 to confirm the exact text before editing.

- [ ] **Step 2: Replace handlePanic with the updated version**

Replace the entire `handlePanic` function with:

```typescript
async function handlePanic() {
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
    // Network error (offline) — queue the panic for when connectivity returns
    const isNetworkError = !(err as { response?: unknown }).response;
    if (isNetworkError) {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await enqueue('post', '/incidents', {
          type: 'other',
          priority: 'critical',
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          description: `🚨 ALERTA DE PÁNICO — ${callSign ?? 'Unidad'} en peligro. Requiere apoyo inmediato.`,
          address: `GPS: ${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`,
        });
      } catch {
        // GPS also failed — enqueue with placeholder coords
        await enqueue('post', '/incidents', {
          type: 'other',
          priority: 'critical',
          lat: 0,
          lng: 0,
          description: `🚨 ALERTA DE PÁNICO — ${callSign ?? 'Unidad'} en peligro. Sin GPS disponible.`,
          address: 'Sin GPS',
        });
      }
      Vibration.vibrate([0, 200, 100, 200]);
      Alert.alert(
        '🚨 Alerta guardada',
        'Sin conexión. La alerta se enviará al centro de mando cuando haya red.',
        [{ text: 'Entendido', style: 'default' }],
      );
    } else {
      Alert.alert('Error', 'No se pudo enviar la alerta. Intenta de nuevo.');
    }
  }
}
```

Note: `enqueue` is already imported at the top of `home.tsx` via:
```typescript
import { flushQueue } from '@/lib/offline-queue';
```

You need to also import `enqueue`:
```typescript
import { flushQueue, enqueue } from '@/lib/offline-queue';
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "home\|handlePanic\|enqueue" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(tabs)/home.tsx
git commit -m "feat(mobile): SOS offline feedback — queue alert and vibrate when no network"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Offline panic queued ✓, vibrate feedback ✓, distinct offline alert ✓
- [x] **No placeholders:** Full code shown including GPS fallback ✓
- [x] **Error discrimination:** `isNetworkError` checks `!error.response` — same pattern axios uses ✓
- [x] **GPS fallback:** If GPS also fails in catch block, panic is still enqueued with placeholder coords so the alert reaches dispatch when online ✓
- [x] **Import update:** `enqueue` added to the import from `offline-queue` ✓
