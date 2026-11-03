import { Tabs } from 'expo-router';

import { NavIcon } from '@/shared/components';
import { useTheme } from '@/hooks/use-theme';

export default function TabLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          height: 62,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoje',
          tabBarAccessibilityLabel: 'Hoje, painel diário',
          tabBarIcon: () => <NavIcon name="dashboard" size={22} />,
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: 'Planejar',
          tabBarAccessibilityLabel: 'Planejar sua rotina',
          tabBarIcon: () => <NavIcon name="planner" size={22} />,
        }}
      />
      <Tabs.Screen
        name="focus"
        options={{
          title: 'Foco',
          tabBarAccessibilityLabel: 'Foco e salas de foco',
          tabBarIcon: () => <NavIcon name="rooms" size={22} />,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          tabBarAccessibilityLabel: 'Amigos e grupos',
          tabBarIcon: () => <NavIcon name="friends" size={22} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarAccessibilityLabel: 'Perfil e configurações',
          tabBarIcon: () => <NavIcon name="profile" size={22} />,
        }}
      />
      <Tabs.Screen name="more" options={{ href: null }} />
    </Tabs>
  );
}
