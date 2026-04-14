// apps/mobile/app/(tabs)/profile.tsx
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { stopLocationTracking } from '@/lib/location';
import ReportIssueModal from '@/components/ReportIssueModal';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador', commander: 'Comandante', supervisor: 'Supervisor',
  operator: 'Operador', field_unit: 'Unidad de Campo',
};

export default function ProfileScreen() {
  const { user, clearAuth } = useAuthStore();
  const [reportOpen, setReportOpen] = useState(false);

  async function handleLogout() {
    await stopLocationTracking();
    await clearAuth();
    router.replace('/login');
  }

  function handleSettings() {
    // Takes user to iOS Ajustes → Velnari Field for permission management.
    Linking.openSettings().catch(() => {});
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

      {/* Action list */}
      <View style={styles.list}>
        <TouchableOpacity
          style={styles.listItem}
          onPress={() => setReportOpen(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Reportar un problema técnico"
        >
          <View style={styles.listIconWrap}>
            <Text style={styles.listIcon}>🐛</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.listTitle}>Reportar problema</Text>
            <Text style={styles.listSubtitle}>Captura y logs se envían automáticamente</Text>
          </View>
          <Text style={styles.listChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.listItem}
          onPress={handleSettings}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Abrir ajustes del sistema"
        >
          <View style={styles.listIconWrap}>
            <Text style={styles.listIcon}>⚙️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.listTitle}>Ajustes del sistema</Text>
            <Text style={styles.listSubtitle}>Permisos de ubicación, cámara, micrófono</Text>
          </View>
          <Text style={styles.listChevron}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Cerrar sesión"
      >
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>

      <ReportIssueModal visible={reportOpen} onClose={() => setReportOpen(false)} />
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
  list: { backgroundColor: '#1E293B', borderRadius: 12, marginBottom: 24, overflow: 'hidden' },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  listIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  listIcon: { fontSize: 18 },
  listTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  listSubtitle: { color: '#64748B', fontSize: 12, marginTop: 2 },
  listChevron: { color: '#475569', fontSize: 20, marginLeft: 8 },
  logoutButton: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#EF4444', borderRadius: 8, padding: 14, alignItems: 'center' },
  logoutText: { color: '#EF4444', fontWeight: '600' },
});
