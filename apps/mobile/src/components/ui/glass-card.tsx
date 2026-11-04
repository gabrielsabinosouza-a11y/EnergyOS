import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, gradients, radii, shadows } from '@/theme';
import { supportsBlur } from './platform';

type GlassCardProps = PropsWithChildren<{
  style?: ViewStyle;
  blur?: boolean;
  accessibilityLabel?: string;
}>;

export function GlassCard({ accessibilityLabel, blur = true, children, style }: GlassCardProps) {
  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.shadow, style]}>
      <LinearGradient
        colors={gradients.glassBorder}
        style={styles.border}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}>
        <View style={styles.surface}>
          {blur && supportsBlur ? (
            <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
          ) : null}
          <View pointerEvents="none" style={styles.surfaceTint} />
          <View style={styles.content}>{children}</View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { ...shadows.card, borderRadius: radii.lg },
  border: { borderRadius: radii.lg, padding: 1 },
  surface: {
    backgroundColor: colors.glass,
    borderRadius: radii.lg - 1,
    overflow: 'hidden',
  },
  surfaceTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.015)',
    borderTopColor: 'rgba(255,255,255,0.10)',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  content: { padding: 16 },
});
