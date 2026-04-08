// apps/mobile/app/(tabs)/profile.tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { stopLocationTracking } from '@/lib/location';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador', commander: 'Comandante', supervisor: 'Supervisor',
  operator: 'Operador', field_unit: 'Unidad de Campo',
};

export default function ProfileScreen() {
  const { user, clearAuth } = useAuthStore();

  async function handleLogout() {
    await stopLocationTracking();
    await clearAuth();
    router.replace('/login');
  }

  if (!user) return null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.role}>{ROLE_LABELS[user.role] ?? user.role}</Text>
        {user.badgeNumber ? <Text style={styles.badge}>Placa: {user.badgeNumber}</Text> : null}
        <Text style={styles.email}>{user.email}</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', padding: 24 },
  card: { backgroundColor: '#1E293B', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  name: { color: '#F8FAFC', fontSize: 20, fontWeight: '600', marginBottom: 4 },
  role: { color: '#3B82F6', fontSize: 13, marginBottom: 4 },
  badge: { color: '#64748B', fontSize: 13, marginBottom: 4 },
  email: { color: '#64748B', fontSize: 13 },
  logoutButton: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#EF4444', borderRadius: 8, padding: 14, alignItems: 'center' },
  logoutText: { color: '#EF4444', fontWeight: '600' },
});
