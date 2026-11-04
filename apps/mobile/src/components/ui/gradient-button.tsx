import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, gradients, radii, typography } from '@/theme';
import { PressableScale } from './pressable-scale';

type GradientButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function GradientButton({
  accessibilityLabel,
  disabled = false,
  icon,
  loading = false,
  onPress,
  style,
  title,
  variant = 'primary',
}: GradientButtonProps) {
  const unavailable = disabled || loading;
  const primary = variant === 'primary';
  const background = primary ? gradients.primary : [colors.glassStrong, colors.glass];

  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: unavailable }}
      disabled={unavailable}
      haptic
      onPress={onPress}
      style={[styles.button, style, unavailable && styles.disabled]}>
      {variant === 'ghost' ? (
        <View style={styles.content}>
          {loading ? <ActivityIndicator color={colors.primary} /> : icon}
          <Text style={[styles.label, { color: colors.primary }]}>{title}</Text>
        </View>
      ) : (
        <LinearGradient
          colors={background}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fill, primary ? null : styles.secondary]}>
          <View style={styles.content}>
            {loading ? (
              <ActivityIndicator color={primary ? '#06111F' : colors.text} />
            ) : (
              icon
            )}
            <Text style={[styles.label, { color: primary ? '#06111F' : colors.text }]}>
              {title}
            </Text>
          </View>
        </LinearGradient>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: radii.md, minHeight: 48, overflow: 'hidden' },
  fill: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 18 },
  secondary: { borderColor: colors.border, borderWidth: 1 },
  content: { alignItems: 'center', flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 48 },
  label: { ...typography.label },
  disabled: { opacity: 0.5 },
});
