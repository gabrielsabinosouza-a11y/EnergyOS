import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, typography } from '@/theme';
import { PressableScale } from './pressable-scale';

type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function ListRow({ accessibilityLabel, icon, onPress, subtitle, title, trailing }: ListRowProps) {
  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={styles.row}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        {subtitle ? <Text numberOfLines={2} style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing ?? <Text style={styles.chevron}>›</Text>}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  icon: { alignItems: 'center', justifyContent: 'center', width: 28 },
  copy: { flex: 1, gap: 2 },
  title: { ...typography.label, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  chevron: { color: colors.textMuted, fontSize: 24, lineHeight: 28 },
});
