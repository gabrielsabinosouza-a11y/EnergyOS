import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, typography } from '@/theme';

type BadgeProps = {
  label: string;
  icon?: ReactNode;
  color?: string;
  backgroundColor?: string;
};

export function Badge({
  backgroundColor = colors.accentBg,
  color = colors.primary,
  icon,
  label,
}: BadgeProps) {
  return (
    <View accessibilityLabel={label} style={[styles.badge, { backgroundColor, borderColor: `${color}55` }]}>
      {icon}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

export const Chip = Badge;

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 26,
    paddingHorizontal: 10,
  },
  label: { ...typography.caption, fontWeight: '700' },
});
