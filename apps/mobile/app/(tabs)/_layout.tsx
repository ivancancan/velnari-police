// apps/mobile/app/(tabs)/_layout.tsx
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
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
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
        name="checklist"
        options={{
          title: 'Checklist',
          tabBarLabel: 'Check',
          tabBarIcon: () => <TabIcon emoji={'\u2705'} />,
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
        name="chat"
        options={{
          title: 'Chat',
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'💬'}</Text>,
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
    </Tabs>
  );
}
