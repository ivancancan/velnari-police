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
    SecureStore.getItemAsync(CONSENT_KEY)
      .then((value) => {
        setConsentGiven(!!value);
        setConsentChecked(true);
      })
      .catch(() => {
        setConsentChecked(true);
      });
  }, [loadStoredAuth]);

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
