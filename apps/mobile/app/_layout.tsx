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
