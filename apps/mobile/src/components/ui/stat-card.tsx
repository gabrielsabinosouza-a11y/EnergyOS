import type { ComponentType, ReactNode } from 'react';
import { useEffect } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { MotiView } from 'moti';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, typography } from '@/theme';
import { GlassCard } from './glass-card';

type StatCardProps = {
  label: string;
  value: string | number;
  suffix?: string;
  icon?: ReactNode;
  color?: string;
  index?: number;
};

export function StatCard({ color = colors.primary, icon, index = 0, label, suffix = '', value }: StatCardProps) {
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
        {typeof value === 'number' ? (
          <CountUpValue color={color} reducedMotion={reducedMotion} suffix={suffix} value={value} />
        ) : (
          <Text numberOfLines={1} style={[styles.value, { color }]}>{value}</Text>
        )}
      </GlassCard>
    </MotiView>
  );
}

type AnimatedTextInputProps = TextInputProps & { text?: string };

const AnimatedTextInput = Animated.createAnimatedComponent(
  TextInput as ComponentType<AnimatedTextInputProps>,
);

function CountUpValue({
  color,
  reducedMotion,
  suffix,
  value,
}: {
  color: string;
  reducedMotion: boolean;
  suffix: string;
  value: number;
}) {
  const count = useSharedValue(reducedMotion ? value : 0);

  useEffect(() => {
    count.set(reducedMotion ? value : withTiming(value, { duration: 650 }));
  }, [count, reducedMotion, value]);

  const animatedProps = useAnimatedProps<AnimatedTextInputProps>(() => ({
    text: `${Math.round(count.get())}${suffix}`,
  }));

  return (
    <AnimatedTextInput
      accessibilityLabel={`${value}${suffix}`}
      accessibilityRole="text"
      animatedProps={animatedProps}
      caretHidden
      contextMenuHidden
      defaultValue={`${reducedMotion ? value : 0}${suffix}`}
      editable={false}
      selectTextOnFocus={false}
      showSoftInputOnFocus={false}
      style={[styles.value, { color }]}
    />
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 0 },
  labelRow: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 24 },
  icon: { alignItems: 'center', height: 22, justifyContent: 'center', width: 22 },
  label: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  value: { ...typography.heading, fontVariant: ['tabular-nums'], marginTop: 9 },
});
