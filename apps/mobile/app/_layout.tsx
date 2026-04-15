// apps/mobile/app/_layout.tsx
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/store/auth.store';
import RealtimeProvider from '@/providers/RealtimeProvider';
import BiometricGate from '@/components/BiometricGate';

import PrivacyConsentModal, { CONSENT_KEY } from '@/components/PrivacyConsentModal';
import OnboardingModal, { ONBOARDING_KEY } from '@/components/OnboardingModal';
import { installLogBuffer } from '@/lib/log-buffer';
import { initSentry, Sentry } from '@/lib/sentry';

// Install the console.log → ring-buffer bridge as early as possible so bug
// reports have real context (the buffer captures everything logged from
// module load forward).
installLogBuffer();
// Crash reporting — no-op in dev if DSN is unset.
initSentry();

function RootLayoutInner() {
  const { loadStoredAuth } = useAuthStore();
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

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

  if (!consentChecked) return null;

  return (
    <SafeAreaProvider>
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
        {!consentGiven && (
          <PrivacyConsentModal onAccept={() => setConsentGiven(true)} />
        )}
        {consentGiven && !onboardingDone && (
          <OnboardingModal onDone={() => setOnboardingDone(true)} />
        )}
      </View>
    </SafeAreaProvider>
  );
}

// Wrap the root so Sentry auto-captures route names & uncaught render errors.
export default Sentry.wrap(RootLayoutInner);
