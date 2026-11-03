import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Text } from './text';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'quiet';
  loading?: boolean;
};

export function Button({
  accessibilityLabel,
  disabled = false,
  loading = false,
  title,
  variant = 'primary',
  ...props
}: ButtonProps) {
  const theme = useTheme();
  const unavailable = disabled || loading;
  const backgroundColor =
    variant === 'primary'
      ? theme.accent
      : variant === 'secondary'
        ? theme.surfaceHover
        : 'transparent';
  const foregroundColor = variant === 'primary' ? '#07111f' : theme.text;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: unavailable }}
      disabled={unavailable}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, borderColor: theme.border },
        variant === 'quiet' && styles.quiet,
        pressed && !unavailable && styles.pressed,
        unavailable && styles.disabled,
      ]}
      {...props}>
      {loading ? (
        <ActivityIndicator color={foregroundColor} />
      ) : (
        <View style={styles.label}>
          <Text color={foregroundColor} variant="label">
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 18,
  },
  quiet: { borderColor: 'transparent' },
  label: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.55 },
});
