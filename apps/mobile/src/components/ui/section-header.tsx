import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/theme';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

export function SectionHeader({ action, icon, subtitle, title }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <Text style={styles.title}>{title}</Text>
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 5 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 28 },
  icon: { alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.heading, color: colors.text, flex: 1 },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  action: { marginLeft: 'auto' },
});
