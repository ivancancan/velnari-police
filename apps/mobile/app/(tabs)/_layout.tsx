// apps/mobile/app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#0F172A', borderTopColor: '#1E293B' },
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#64748B',
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: '#F8FAFC',
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Servicio', tabBarLabel: 'Servicio' }} />
      <Tabs.Screen name="profile" options={{ title: 'Mi perfil', tabBarLabel: 'Perfil' }} />
    </Tabs>
  );
}
