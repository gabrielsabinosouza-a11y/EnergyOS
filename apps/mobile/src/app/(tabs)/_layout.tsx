import { Tabs } from 'expo-router';

import { NavIcon } from '@/shared/components';
import { useTheme } from '@/hooks/use-theme';
import { FloatingTabBar } from '@/components/ui/floating-tab-bar';

export default function TabLayout() {
  const theme = useTheme();

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoje',
          tabBarAccessibilityLabel: 'Hoje, painel diário',
          tabBarIcon: ({ color }) => <NavIcon color={color} name="dashboard" size={22} />,
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: 'Planejar',
          tabBarAccessibilityLabel: 'Planejar sua rotina',
          tabBarIcon: ({ color }) => <NavIcon color={color} name="planner" size={22} />,
        }}
      />
      <Tabs.Screen
        name="focus"
        options={{
          title: 'Foco',
          tabBarAccessibilityLabel: 'Foco e salas de foco',
          tabBarIcon: ({ color }) => <NavIcon color={color} name="rooms" size={22} />,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          tabBarAccessibilityLabel: 'Amigos e grupos',
          tabBarIcon: ({ color }) => <NavIcon color={color} name="friends" size={22} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarAccessibilityLabel: 'Perfil e configurações',
          tabBarIcon: ({ color }) => <NavIcon color={color} name="profile" size={22} />,
        }}
      />
      <Tabs.Screen name="more" options={{ href: null }} />
    </Tabs>
  );
}
