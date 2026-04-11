# 3-Step Onboarding Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a 3-screen in-app onboarding carousel on first launch (after consent, before the main app). Officers see what each tab does and how to use the panic button. Shown once per install, skip-able, stored in SecureStore.

**Architecture:** `OnboardingModal` is a full-screen `Modal` with a 3-step `FlatList`-based horizontal swiper. Each step is a full-screen card with icon, title, and description. A "Continuar" button advances steps; step 3 has "Comenzar". Completion stored in `SecureStore` under `velnari_onboarding_done`. Mounted in `_layout.tsx` after consent check — only shown when consent is given but onboarding is not done.

**Tech Stack:** React Native `Modal`, `FlatList`, `Animated`, `SecureStore`.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/mobile/src/components/OnboardingModal.tsx` | Create | 3-step swipeable carousel modal |
| `apps/mobile/app/_layout.tsx` | Modify | Add onboarding check + mount OnboardingModal |

---

### Task 1: Create OnboardingModal

**Files:**
- Create: `apps/mobile/src/components/OnboardingModal.tsx`

- [ ] **Step 1: Write the component**

```typescript
// apps/mobile/src/components/OnboardingModal.tsx
import { useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, FlatList, StyleSheet,
  Dimensions, Animated,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const ONBOARDING_KEY = 'velnari_onboarding_done';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Step {
  key: string;
  icon: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    key: 'home',
    icon: '🏠',
    title: 'Tu centro de operaciones',
    body: 'En la pestaña Inicio verás tu unidad asignada, el incidente activo, y el botón de rastreo GPS. Mantén el GPS activo durante tu turno para que el centro de mando te ubique.',
  },
  {
    key: 'dispatch',
    icon: '📋',
    title: 'Reporta incidentes',
    body: 'Usa la pestaña Reporte para crear incidentes desde campo: selecciona tipo, prioridad y ubicación. Puedes adjuntar fotos y trabajar sin conexión — se sincronizarán automáticamente.',
  },
  {
    key: 'sos',
    icon: '🚨',
    title: 'Botón de pánico SOS',
    body: 'En la pantalla de Inicio, el botón rojo SOS envía tu ubicación al centro de mando de inmediato. Mantén presionado 1 segundo para activarlo. Funciona sin conexión.',
  },
];

export default function OnboardingModal({ onDone }: { onDone: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const flatListRef = useRef<FlatList<Step>>(null);
  const dotAnim = useRef(new Animated.Value(0)).current;

  function goToStep(index: number) {
    setCurrentStep(index);
    flatListRef.current?.scrollToIndex({ index, animated: true });
    Animated.spring(dotAnim, { toValue: index, useNativeDriver: false, bounciness: 6 }).start();
  }

  async function handleDone() {
    setCompleting(true);
    try {
      await SecureStore.setItemAsync(ONBOARDING_KEY, '1');
    } catch {
      // If storage fails, still complete onboarding
    }
    onDone();
    setCompleting(false);
  }

  const isLast = currentStep === STEPS.length - 1;

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent>
      <View style={styles.container}>
        {/* Skip button */}
        <TouchableOpacity style={styles.skipButton} onPress={handleDone}>
          <Text style={styles.skipText}>Omitir</Text>
        </TouchableOpacity>

        {/* Swiper */}
        <FlatList
          ref={flatListRef}
          data={STEPS}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <Text style={styles.icon}>{item.icon}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          )}
        />

        {/* Dot indicators */}
        <View style={styles.dotsRow}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentStep ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* Action button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, completing && styles.buttonDisabled]}
            onPress={() => {
              if (isLast) {
                void handleDone();
              } else {
                goToStep(currentStep + 1);
              }
            }}
            disabled={completing}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {completing ? 'Cargando...' : isLast ? 'Comenzar' : 'Continuar →'}
            </Text>
          </TouchableOpacity>

          {!isLast && (
            <Text style={styles.stepIndicator}>
              {currentStep + 1} de {STEPS.length}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  skipButton: { position: 'absolute', top: 56, right: 24, zIndex: 10, padding: 8 },
  skipText: { color: '#64748B', fontSize: 14, fontWeight: '600' },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 160,
  },
  icon: { fontSize: 80, marginBottom: 32 },
  title: { color: '#F8FAFC', fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 20, lineHeight: 34 },
  body: { color: '#94A3B8', fontSize: 16, textAlign: 'center', lineHeight: 26 },
  dotsRow: { position: 'absolute', bottom: 140, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: '#3B82F6', width: 24 },
  dotInactive: { backgroundColor: '#334155' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 32, paddingBottom: 48 },
  button: { backgroundColor: '#3B82F6', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  stepIndicator: { color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 16 },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "OnboardingModal\|onboarding" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/OnboardingModal.tsx
git commit -m "feat(mobile): 3-step onboarding carousel modal"
```

---

### Task 2: Wire OnboardingModal into _layout.tsx

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

The current `_layout.tsx` (after the privacy notice plan was implemented) already has `consentGiven` state. We extend it with `onboardingDone` state.

- [ ] **Step 1: Read current _layout.tsx to see post-privacy-plan state**

Read `apps/mobile/app/_layout.tsx` to confirm the current imports and structure before editing.

- [ ] **Step 2: Add onboarding state and check**

Add `onboardingDone` alongside the consent check:

```typescript
import OnboardingModal, { ONBOARDING_KEY } from '@/components/OnboardingModal';

// Inside RootLayout(), alongside existing state:
const [onboardingDone, setOnboardingDone] = useState(false);

// In the useEffect (alongside consent check):
useEffect(() => {
  loadStoredAuth();
  Promise.all([
    SecureStore.getItemAsync(CONSENT_KEY),
    SecureStore.getItemAsync(ONBOARDING_KEY),
  ])
    .then(([consent, onboarding]) => {
      setConsentGiven(!!consent);
      setOnboardingDone(!!onboarding);
      setConsentChecked(true);
    })
    .catch(() => {
      setConsentChecked(true);
    });
}, [loadStoredAuth]);
```

Add `OnboardingModal` after `PrivacyConsentModal` in the render:

```tsx
      {/* Show onboarding only after consent is given and onboarding not yet done */}
      {consentGiven && !onboardingDone && (
        <OnboardingModal onDone={() => setOnboardingDone(true)} />
      )}
```

The full updated render block (inside the `View` with `flex: 1`):

```tsx
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
      {!consentGiven && (
        <PrivacyConsentModal onAccept={() => setConsentGiven(true)} />
      )}
      {consentGiven && !onboardingDone && (
        <OnboardingModal onDone={() => setOnboardingDone(true)} />
      )}
    </View>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "_layout\|onboarding" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): show onboarding carousel after consent on first launch"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** 3 screens ✓, skip-able ✓, shown once (SecureStore) ✓, explains GPS/panic/reports ✓
- [x] **No placeholders:** Full component and layout changes shown ✓
- [x] **Order:** Consent modal → Onboarding modal → App. Correct sequencing ✓
- [x] **scrollEnabled false:** User can only advance via button, not swipe — cleaner UX in field context ✓
- [x] **dot indicator width change:** Active dot is wider (24px) for visual distinction ✓
- [x] **Skip from any step:** Skip button calls handleDone() immediately, saving to SecureStore ✓
