# Offline UX Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a persistent offline banner at the top of every screen when the device has no network, and display the count of pending queued items (JSON actions + photos + GPS points) so the officer knows data is being held locally.

**Architecture:** `useNetworkStatus` hook wraps `@react-native-community/netinfo` and exposes `isConnected: boolean`. `OfflineBanner` reads the three queue stores (AsyncStorage) to compute a pending count and renders a top strip when offline. Both are wired into the root `_layout.tsx` so they appear on every screen without per-screen changes.

**Tech Stack:** `@react-native-community/netinfo`, `AsyncStorage` (already available via `expo`), React Native `Animated` for slide-in, `_layout.tsx` injection.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/mobile/package.json` | Modify | Add `@react-native-community/netinfo` |
| `apps/mobile/src/hooks/useNetworkStatus.ts` | Create | Subscribe to network state changes |
| `apps/mobile/src/components/OfflineBanner.tsx` | Create | Offline strip with pending count |
| `apps/mobile/app/_layout.tsx` | Modify | Mount OfflineBanner above Stack |

---

### Task 1: Install @react-native-community/netinfo

**Files:**
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Install the package**

```bash
cd apps/mobile && npx expo install @react-native-community/netinfo
```

Expected output: package added to `package.json` and `pnpm-lock.yaml` updated.

- [ ] **Step 2: Verify import resolves**

```bash
cd apps/mobile && node -e "require('@react-native-community/netinfo')" 2>&1
```

Expected: no module error (the require itself may fail in Node context but the file should exist in `node_modules`).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml
git commit -m "chore(mobile): install @react-native-community/netinfo"
```

---

### Task 2: useNetworkStatus hook

**Files:**
- Create: `apps/mobile/src/hooks/useNetworkStatus.ts`

- [ ] **Step 1: Write the hook**

```typescript
// apps/mobile/src/hooks/useNetworkStatus.ts
import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export function useNetworkStatus(): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // Get current state immediately
    NetInfo.fetch().then((state: NetInfoState) => {
      setIsConnected(state.isConnected ?? true);
    });

    // Subscribe to future changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected ?? true);
    });

    return unsubscribe;
  }, []);

  return { isConnected };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "useNetworkStatus\|netinfo" | head -10
```

Expected: no errors referencing useNetworkStatus or netinfo.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/useNetworkStatus.ts
git commit -m "feat(mobile): useNetworkStatus hook"
```

---

### Task 3: OfflineBanner component

**Files:**
- Create: `apps/mobile/src/components/OfflineBanner.tsx`

The banner needs to:
1. Only render when `isConnected === false`
2. Read all three queue keys from AsyncStorage to get pending count
3. Slide in from top with animation
4. Show: "Sin conexión · N pendiente(s)"

The queue keys used in the existing codebase:
- JSON offline queue: `'offline_queue'` (in `apps/mobile/src/lib/offline-queue.ts`)
- Photo queue: `'offline_photo_queue'` (in `apps/mobile/src/lib/photo-queue.ts`)
- Location queue: `'offline_location_queue'` (in `apps/mobile/src/lib/location-queue.ts`)

- [ ] **Step 1: Verify the AsyncStorage queue keys**

Read the three queue files to confirm the keys:
- `apps/mobile/src/lib/offline-queue.ts` — look for the AsyncStorage key constant
- `apps/mobile/src/lib/photo-queue.ts` — same
- `apps/mobile/src/lib/location-queue.ts` — same

Use the exact keys you find. If they differ from the ones listed above, use the actual keys.

- [ ] **Step 2: Write OfflineBanner**

```typescript
// apps/mobile/src/components/OfflineBanner.tsx
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

// These keys must match the constants in offline-queue.ts, photo-queue.ts, location-queue.ts
const QUEUE_KEYS = ['offline_queue', 'offline_photo_queue', 'offline_location_queue'];

async function getPendingCount(): Promise<number> {
  try {
    const values = await AsyncStorage.multiGet(QUEUE_KEYS);
    let total = 0;
    for (const [, value] of values) {
      if (!value) continue;
      const parsed = JSON.parse(value) as unknown[];
      if (Array.isArray(parsed)) total += parsed.length;
    }
    return total;
  } catch {
    return 0;
  }
}

export default function OfflineBanner() {
  const { isConnected } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const slideAnim = useRef(new Animated.Value(-48)).current;

  useEffect(() => {
    if (!isConnected) {
      getPendingCount().then(setPendingCount);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: -48, useNativeDriver: true, duration: 200 }).start();
    }
  }, [isConnected, slideAnim]);

  // Refresh count every 5s while offline
  useEffect(() => {
    if (isConnected) return;
    const interval = setInterval(() => {
      getPendingCount().then(setPendingCount);
    }, 5000);
    return () => clearInterval(interval);
  }, [isConnected]);

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.inner}>
        <Text style={styles.dot}>●</Text>
        <Text style={styles.text}>
          Sin conexión
          {pendingCount > 0 ? ` · ${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}` : ''}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#F59E0B',
    paddingTop: 44, // safe area offset — covers status bar on iPhone
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    color: '#78350F',
    fontSize: 10,
  },
  text: {
    color: '#78350F',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "OfflineBanner\|offline_banner\|netinfo" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/OfflineBanner.tsx
git commit -m "feat(mobile): OfflineBanner component with pending queue count"
```

---

### Task 4: Wire OfflineBanner into _layout.tsx

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Add OfflineBanner to the layout**

The current `_layout.tsx` renders:
```tsx
<StatusBar style="light" />
<RealtimeProvider>
  <BiometricGate>
    <Stack ...>
```

Modify it to add `OfflineBanner` as an overlay inside the outermost element. Wrap the content in a `View` with `flex: 1` to allow absolute positioning:

```tsx
// apps/mobile/app/_layout.tsx
import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/auth.store';
import RealtimeProvider from '@/providers/RealtimeProvider';
import BiometricGate from '@/components/BiometricGate';
import OfflineBanner from '@/components/OfflineBanner';

export default function RootLayout() {
  const { loadStoredAuth } = useAuthStore();
  useEffect(() => { loadStoredAuth(); }, [loadStoredAuth]);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <RealtimeProvider>
        <BiometricGate>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#0F172A' },
              headerTintColor: '#F8FAFC',
              contentStyle: { backgroundColor: '#0F172A' },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </BiometricGate>
      </RealtimeProvider>
      <OfflineBanner />
    </View>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "_layout\|OfflineBanner" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): mount OfflineBanner in root layout — visible on all screens"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Connectivity detection ✓, offline banner ✓, pending count ✓, all screens covered via _layout ✓
- [x] **No placeholders:** All code is complete with correct queue keys guidance
- [x] **Type consistency:** `useNetworkStatus` returns `{ isConnected: boolean }`, consumed correctly in OfflineBanner
- [x] **No crash when offline:** `getPendingCount` catches all errors, returns 0
- [x] **Animation:** Slides in from top on disconnect, slides out on reconnect
- [x] **paddingTop 44:** Covers iOS status bar height so banner appears below it, not behind it
