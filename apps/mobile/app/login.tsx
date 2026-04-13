// apps/mobile/app/login.tsx
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { registerForPushNotifications } from '@/lib/notifications';

export default function LoginScreen() {
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email || !password) { setError('Ingresa email y contraseña'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login(email, password);
      // store token so the interceptor picks it up for the /auth/me call
      const { setItemAsync } = await import('expo-secure-store');
      await setItemAsync('accessToken', res.data.accessToken);
      const meRes = await authApi.me();
      await setAuth(res.data.accessToken, res.data.refreshToken, meRes.data);
      // Register push token and send to backend (non-blocking)
      registerForPushNotifications()
        .then((token) => { if (token) return authApi.updatePushToken(token); })
        .catch(() => {});
      router.replace('/(tabs)/home');
    } catch {
      setError('Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>VELNARI</Text>
        <Text style={styles.subtitle}>Field Operations</Text>

        {error ? (
          <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            {error}
          </Text>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#64748B"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          accessibilityLabel="Correo electrónico"
          accessibilityHint="Ingresa el email de tu cuenta de Velnari"
          returnKeyType="next"
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#64748B"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          accessibilityLabel="Contraseña"
          accessibilityHint="Ingresa la contraseña de tu cuenta"
          returnKeyType="go"
          onSubmitEditing={handleLogin}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Ingresar a Velnari Field"
          accessibilityState={{ disabled: loading, busy: loading }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Ingresar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  inner: { flex: 1, justifyContent: 'center', padding: 32 },
  title: { fontSize: 32, fontWeight: '700', color: '#F8FAFC', textAlign: 'center', letterSpacing: 6 },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 48 },
  error: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginBottom: 16, backgroundColor: '#450a0a', padding: 10, borderRadius: 8 },
  input: {
    backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155',
    borderRadius: 8, padding: 14, color: '#F8FAFC', fontSize: 15, marginBottom: 12,
  },
  button: { backgroundColor: '#3B82F6', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
