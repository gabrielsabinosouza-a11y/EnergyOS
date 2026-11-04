export interface NavigationItem {
  id: string;
  label: string;
  shortLabel: string;
  icon: string;
  mobileRoute: string;
}

export const navigationItems: NavigationItem[] = [
  {
    id: 'overview',
    label: 'Hoje',
    shortLabel: 'Hoje',
    icon: 'house',
    mobileRoute: '/(tabs)',
  },
  {
    id: 'planner',
    label: 'Planejar',
    shortLabel: 'Planejar',
    icon: 'calendar',
    mobileRoute: '/(tabs)/planner',
  },
  {
    id: 'focusRooms',
    label: 'Foco',
    shortLabel: 'Foco',
    icon: 'timer',
    mobileRoute: '/(tabs)/focus',
  },
  {
    id: 'friends',
    label: 'Social',
    shortLabel: 'Social',
    icon: 'users',
    mobileRoute: '/(tabs)/social',
  },
  {
    id: 'profile',
    label: 'Perfil',
    shortLabel: 'Perfil',
    icon: 'user',
    mobileRoute: '/(tabs)/profile',
  },
];
