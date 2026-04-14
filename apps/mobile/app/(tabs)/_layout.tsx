// apps/mobile/app/(tabs)/_layout.tsx
//
// Tab bar intentionally limited to 4 tabs for field operations:
//   Servicio (home) · Mapa · Reportar · Perfil
//
// Checklist and Chat are still implemented as routes but hidden from the
// tab bar (accessible from home quick actions / per-incident chat). Having
// 6 tabs overwhelms officers with thick gloves trying to scan one-handed.
//
// Label fontSize dropped 11→10 so names don't wrap on iPhone SE (375pt).
import { Text } from 'react-native';
import { Tabs } from 'expo-router';

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#0F172A', borderTopColor: '#1E293B', height: 60, paddingBottom: 8 },
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: '#F8FAFC',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Servicio',
          tabBarLabel: 'Servicio',
          tabBarIcon: () => <TabIcon emoji="🚔" />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Mapa',
          tabBarLabel: 'Mapa',
          headerShown: false,
          tabBarIcon: () => <TabIcon emoji="🗺️" />,
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: 'Reportar',
          tabBarLabel: 'Reportar',
          tabBarIcon: () => <TabIcon emoji="🚨" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Mi perfil',
          tabBarLabel: 'Perfil',
          tabBarIcon: () => <TabIcon emoji="👤" />,
        }}
      />
      {/* Routes preserved but hidden from tab bar — accessed via quick actions */}
      <Tabs.Screen
        name="checklist"
        options={{
          href: null,
          title: 'Checklist',
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          href: null,
          title: 'Chat',
          headerShown: true,
        }}
      />
    </Tabs>
  );
}
