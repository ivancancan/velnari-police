// apps/mobile/app/_layout.tsx
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/auth.store';
import { registerForPushNotifications } from '@/lib/notifications';

export default function RootLayout() {
  const { loadStoredAuth } = useAuthStore();
  useEffect(() => { loadStoredAuth(); }, [loadStoredAuth]);

  useEffect(() => {
    loadStoredAuth().then(() => {
      registerForPushNotifications();
    });
  }, []);

  return (
    <>
      <StatusBar style="light" />
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
    </>
  );
}
