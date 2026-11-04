import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';

import { colors, typography } from '@/theme';
import { GlassCard } from './glass-card';

type StatCardProps = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: string;
  index?: number;
};

export function StatCard({ color = colors.primary, icon, index = 0, label, value }: StatCardProps) {
  const reducedMotion = useReducedMotion();

  return (
    <MotiView
      from={reducedMotion ? undefined : { opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: reducedMotion ? 0 : 250, delay: reducedMotion ? 0 : index * 55 }}>
      <GlassCard blur={false} style={styles.card}>
        <View style={styles.labelRow}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text numberOfLines={1} style={styles.label}>{label}</Text>
        </View>
        <Text numberOfLines={1} style={[styles.value, { color }]}>{value}</Text>
      </GlassCard>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 0 },
  labelRow: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 24 },
  icon: { alignItems: 'center', height: 22, justifyContent: 'center', width: 22 },
  label: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  value: { ...typography.heading, fontVariant: ['tabular-nums'], marginTop: 9 },
});
