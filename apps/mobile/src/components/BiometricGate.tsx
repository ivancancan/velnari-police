import { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuthStore } from '@/store/auth.store';

const LOCK_AFTER_MS = 60_000; // Lock after 1 minute in background

export default function BiometricGate({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [isLocked, setIsLocked] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then((hasHardware) => {
      if (hasHardware) {
        LocalAuthentication.isEnrolledAsync().then(setBiometricAvailable);
      }
    });
  }, []);

  const authenticate = useCallback(async () => {
    if (!biometricAvailable) {
      // No biometrics — just unlock (device-level security is sufficient)
      setIsLocked(false);
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloquear Velnari Field',
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar PIN',
      disableDeviceFallback: false,
    });

    if (result.success) {
      setIsLocked(false);
    }
  }, [biometricAvailable]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (nextAppState === 'active' && isAuthenticated) {
        const elapsed = backgroundedAt.current
          ? Date.now() - backgroundedAt.current
          : 0;
        if (elapsed >= LOCK_AFTER_MS && biometricAvailable) {
          setIsLocked(true);
          authenticate();
        }
        backgroundedAt.current = null;
      }
    });

    return () => subscription.remove();
  }, [isAuthenticated, biometricAvailable, authenticate]);

  if (!isAuthenticated || !isLocked) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>Velnari Field</Text>
      <Text style={styles.subtitle}>Sesión bloqueada por inactividad</Text>
      <TouchableOpacity style={styles.button} onPress={authenticate}>
        <Text style={styles.buttonText}>Desbloquear</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '600',
  },
});
