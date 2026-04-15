// apps/mobile/app/login.tsx
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert, Linking,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { registerForPushNotifications } from '@/lib/notifications';

const APP_VERSION =
  Constants.expoConfig?.version ?? '1.0.0';
const BUILD_NUMBER =
  Constants.expoConfig?.ios?.buildNumber ??
  String(Constants.expoConfig?.android?.versionCode ?? 'dev');

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
      // Store token synchronously so the axios interceptor picks it up when
      // we call /auth/me below. Static import keeps tsc happy (was dynamic).
      await SecureStore.setItemAsync('accessToken', res.data.accessToken);
      const meRes = await authApi.me();
      await setAuth(res.data.accessToken, res.data.refreshToken, meRes.data);
      // Register push token and send to backend (non-blocking)
      registerForPushNotifications()
        .then((token) => { if (token) return authApi.updatePushToken(token); })
        .catch(() => {});
      router.replace('/(tabs)/home');
    } catch (err) {
      // Map common cases to actionable Spanish copy with a verb. Keeps the
      // officer in the loop instead of a flat "ocurrió un error".
      const code = (err as { response?: { status?: number } }).response?.status;
      if (code === 423) {
        setError('Cuenta bloqueada por intentos fallidos. Espera 15 minutos o pide a tu supervisor que la desbloquee.');
      } else if (code === 401) {
        setError('Credenciales incorrectas. Revisa el email y vuelve a intentar.');
      } else {
        setError('No pudimos iniciar sesión. Revisa tu conexión e inténtalo de nuevo.');
      }
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

        <TouchableOpacity
          onPress={() => Alert.alert(
            '¿Olvidaste tu contraseña?',
            'Pide a tu supervisor que restablezca tu contraseña en el panel de Velnari Command. Por seguridad, los oficiales no pueden restablecerla desde el dispositivo.',
            [{ text: 'Entendido', style: 'default' }],
          )}
          accessibilityRole="button"
          accessibilityLabel="¿Olvidaste tu contraseña?"
          style={styles.forgotLink}
        >
          <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.trustText}>
          🔒 Datos cifrados en tránsito y en reposo
        </Text>
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>v{APP_VERSION} ({BUILD_NUMBER})</Text>
          <Text style={styles.footerText}>·</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://velnari.mx/privacidad')}
            accessibilityRole="link"
            accessibilityLabel="Política de privacidad"
          >
            <Text style={[styles.footerText, styles.footerLink]}>Privacidad</Text>
          </TouchableOpacity>
        </View>
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
  forgotLink: { marginTop: 16, alignItems: 'center', padding: 8 },
  forgotText: { color: '#94A3B8', fontSize: 13, fontWeight: '500' },
  footer: {
    paddingHorizontal: 32, paddingBottom: 32,
    alignItems: 'center', gap: 6,
  },
  trustText: { color: '#64748B', fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  footerRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  footerText: { color: '#475569', fontSize: 11, fontWeight: '500' },
  footerLink: { color: '#64748B', textDecorationLine: 'underline' },
});
