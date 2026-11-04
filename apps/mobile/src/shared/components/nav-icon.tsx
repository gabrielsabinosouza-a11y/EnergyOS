import { Image, type ColorValue, type ImageSourcePropType, StyleSheet } from 'react-native';

const icons = {
  consistency: require('../../../assets/energyos/navigation/consistency.png'),
  dashboard: require('../../../assets/energyos/navigation/dashboard.png'),
  friends: require('../../../assets/energyos/navigation/friends.png'),
  garden: require('../../../assets/energyos/navigation/garden.png'),
  groups: require('../../../assets/energyos/navigation/groups.png'),
  league: require('../../../assets/energyos/navigation/leaderboard.png'),
  planner: require('../../../assets/energyos/navigation/planner.png'),
  profile: require('../../../assets/energyos/navigation/profile.png'),
  rooms: require('../../../assets/energyos/navigation/rooms.png'),
  settings: require('../../../assets/energyos/navigation/settings.png'),
  store: require('../../../assets/energyos/navigation/store.png'),
} satisfies Record<string, ImageSourcePropType>;

export type NavIconName = keyof typeof icons;

type NavIconProps = {
  name: NavIconName;
  size?: number;
  color?: ColorValue;
};

export function NavIcon({ color, name, size = 24 }: NavIconProps) {
  return (
    <Image
      accessible={false}
      resizeMode="contain"
      source={icons[name]}
      style={[styles.icon, { height: size, tintColor: color, width: size }]}
    />
  );
}

const styles = StyleSheet.create({
  icon: { flexShrink: 0 },
});
