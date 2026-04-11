# Privacy Notice / LFPDPPP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a LFPDPPP-compliant privacy consent modal on first launch (once per install). The modal explains what data is collected (GPS, biometric auth, incident reports), provides a link to the privacy notice, and requires the officer to tap "Acepto" before using the app. Consent timestamp is stored in SecureStore.

**Architecture:** A `PrivacyConsentModal` component (Modal overlay) is rendered in `_layout.tsx` only when no consent timestamp is found in SecureStore (`velnari_privacy_consent`). On "Acepto", save the timestamp and hide the modal. No backend call needed — consent is stored locally per device (LFPDPPP requires proof of consent; we store it on device for MVP and can sync to backend later).

**Tech Stack:** `expo-secure-store`, React Native `Modal`, `_layout.tsx`.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/mobile/src/components/PrivacyConsentModal.tsx` | Create | Full-screen consent modal with accept button |
| `apps/mobile/app/_layout.tsx` | Modify | Mount PrivacyConsentModal, check consent on app start |

---

### Task 1: Create PrivacyConsentModal component

**Files:**
- Create: `apps/mobile/src/components/PrivacyConsentModal.tsx`

- [ ] **Step 1: Write the component**

```typescript
// apps/mobile/src/components/PrivacyConsentModal.tsx
import { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Linking,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const CONSENT_KEY = 'velnari_privacy_consent';

export default function PrivacyConsentModal({ onAccept }: { onAccept: () => void }) {
  const [accepting, setAccepting] = useState(false);

  async function handleAccept() {
    setAccepting(true);
    try {
      await SecureStore.setItemAsync(CONSENT_KEY, new Date().toISOString());
      onAccept();
    } catch {
      // If SecureStore fails, still allow the user to proceed
      onAccept();
    } finally {
      setAccepting(false);
    }
  }

  return (
    <Modal visible animationType="slide" transparent={false} statusBarTranslucent>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>Velnari Field</Text>
          <Text style={styles.title}>Aviso de Privacidad</Text>
          <Text style={styles.subtitle}>Conforme a la LFPDPPP</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>¿Qué datos recopilamos?</Text>

          <View style={styles.item}>
            <Text style={styles.itemIcon}>📍</Text>
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>Ubicación GPS en tiempo real</Text>
              <Text style={styles.itemDesc}>Tu posición se transmite al centro de mando durante el turno para coordinar despachos y registrar rutas de patrullaje.</Text>
            </View>
          </View>

          <View style={styles.item}>
            <Text style={styles.itemIcon}>🔒</Text>
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>Autenticación biométrica</Text>
              <Text style={styles.itemDesc}>La biometría (huella/Face ID) se usa localmente en el dispositivo para desbloquear la app. No se transmite a nuestros servidores.</Text>
            </View>
          </View>

          <View style={styles.item}>
            <Text style={styles.itemIcon}>📋</Text>
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>Reportes e imágenes de incidentes</Text>
              <Text style={styles.itemDesc}>Los informes que crees y las fotos que adjuntes se almacenan cifrados en servidores de Velnari ubicados en México.</Text>
            </View>
          </View>

          <View style={styles.item}>
            <Text style={styles.itemIcon}>🔔</Text>
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>Notificaciones push</Text>
              <Text style={styles.itemDesc}>El identificador de notificaciones de tu dispositivo se almacena para enviarte alertas de despacho.</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Tus derechos ARCO</Text>
          <Text style={styles.body}>
            Tienes derecho de Acceso, Rectificación, Cancelación y Oposición (ARCO) sobre tus datos personales. Para ejercerlos, contacta a tu administrador municipal o escríbenos a{' '}
            <Text style={styles.link} onPress={() => Linking.openURL('mailto:privacidad@velnari.mx')}>
              privacidad@velnari.mx
            </Text>
            .
          </Text>

          <Text style={styles.body}>
            Al usar esta aplicación en el cumplimiento de tus funciones, el tratamiento de tus datos se realiza con base en la relación laboral y en la Ley General de Seguridad Pública.
          </Text>

          <TouchableOpacity onPress={() => Linking.openURL('https://velnari.mx/privacidad')}>
            <Text style={styles.policyLink}>Ver aviso de privacidad completo →</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.acceptButton, accepting && styles.acceptButtonDisabled]}
            onPress={handleAccept}
            disabled={accepting}
            activeOpacity={0.8}
          >
            <Text style={styles.acceptText}>{accepting ? 'Registrando...' : 'Acepto y continuar'}</Text>
          </TouchableOpacity>
          <Text style={styles.footerNote}>
            Al aceptar, confirmas haber leído este aviso. Este registro se guarda en tu dispositivo.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  logo: { color: '#3B82F6', fontSize: 13, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  title: { color: '#F8FAFC', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#64748B', fontSize: 14, marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 32 },
  sectionTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 16, marginTop: 8 },
  item: { flexDirection: 'row', gap: 14, marginBottom: 18 },
  itemIcon: { fontSize: 22, marginTop: 2 },
  itemText: { flex: 1 },
  itemTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  itemDesc: { color: '#94A3B8', fontSize: 13, lineHeight: 19 },
  body: { color: '#94A3B8', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  link: { color: '#3B82F6', textDecorationLine: 'underline' },
  policyLink: { color: '#3B82F6', fontSize: 14, fontWeight: '600', marginTop: 8, marginBottom: 8 },
  footer: { padding: 24, borderTopWidth: 1, borderTopColor: '#1E293B' },
  acceptButton: { backgroundColor: '#3B82F6', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  acceptButtonDisabled: { opacity: 0.5 },
  acceptText: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  footerNote: { color: '#475569', fontSize: 11, textAlign: 'center', lineHeight: 16 },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "PrivacyConsentModal\|privacy" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/PrivacyConsentModal.tsx
git commit -m "feat(mobile): PrivacyConsentModal — LFPDPPP first-launch consent"
```

---

### Task 2: Wire PrivacyConsentModal into _layout.tsx

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Read current _layout.tsx**

Read `apps/mobile/app/_layout.tsx` to confirm current imports and render structure.

- [ ] **Step 2: Add consent check and modal**

Add the consent state check to `RootLayout` and render `PrivacyConsentModal` as an overlay when consent has not been given. The full updated `_layout.tsx`:

```typescript
// apps/mobile/app/_layout.tsx
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/store/auth.store';
import RealtimeProvider from '@/providers/RealtimeProvider';
import BiometricGate from '@/components/BiometricGate';
import OfflineBanner from '@/components/OfflineBanner';
import PrivacyConsentModal, { CONSENT_KEY } from '@/components/PrivacyConsentModal';

export default function RootLayout() {
  const { loadStoredAuth } = useAuthStore();
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);

  useEffect(() => {
    loadStoredAuth();
    // Check if consent was already given on a previous launch
    SecureStore.getItemAsync(CONSENT_KEY)
      .then((value) => {
        setConsentGiven(!!value);
        setConsentChecked(true);
      })
      .catch(() => {
        // SecureStore error — assume no consent (show modal)
        setConsentChecked(true);
      });
  }, [loadStoredAuth]);

  // Don't render anything until we know consent state (avoids flash)
  if (!consentChecked) return null;

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
      {!consentGiven && (
        <PrivacyConsentModal onAccept={() => setConsentGiven(true)} />
      )}
    </View>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "_layout\|PrivacyConsent\|consent" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): show LFPDPPP consent modal on first launch"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** First-launch modal ✓, consent in SecureStore ✓, GPS + biometric + reports explained ✓
- [x] **No placeholders:** Full component and layout code shown ✓
- [x] **LFPDPPP requirements:** Data categories named ✓, ARCO rights mentioned ✓, responsible entity identifiable (privacidad@velnari.mx) ✓, timestamp stored ✓
- [x] **No flash:** `consentChecked` gate prevents showing app briefly before modal ✓
- [x] **SecureStore error tolerance:** If consent check throws, modal is shown (safe default) ✓
- [x] **Biometric note:** Clearly states biometrics are NOT sent to server ✓
