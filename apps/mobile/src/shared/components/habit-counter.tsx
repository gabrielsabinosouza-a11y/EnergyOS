import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Text } from '@/shared/components/text';

type HabitCounterProps = {
  habitName: string;
  count: number;
  target: number;
  busy?: boolean;
  disabled?: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
};

export function HabitCounter({
  habitName,
  count,
  target,
  busy = false,
  disabled = false,
  onDecrement,
  onIncrement,
}: HabitCounterProps) {
  const theme = useTheme();
  const isDisabled = disabled || busy;
  const decrementDisabled = isDisabled || count <= 0;
  const incrementDisabled = isDisabled || count >= target;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel={`Diminuir check-ins de ${habitName}`}
        accessibilityRole="button"
        accessibilityState={{ busy, disabled: decrementDisabled }}
        disabled={decrementDisabled}
        onPress={onDecrement}
        style={({ pressed }) => [
          styles.button,
          { borderColor: theme.borderStrong },
          pressed && styles.pressed,
          decrementDisabled && styles.disabled,
        ]}>
        <Text color={theme.text} style={styles.symbol} variant="label">
          −
        </Text>
      </Pressable>

      <Text
        accessibilityLabel={`${habitName}: ${count} de ${target}`}
        accessibilityRole="progressbar"
        color={count >= target ? theme.green : theme.accent}
        style={styles.count}
        variant="caption">
        {busy ? '…' : `${count}/${target}`}
      </Text>

      <Pressable
        accessibilityLabel={`Adicionar check-in para ${habitName}`}
        accessibilityRole="button"
        accessibilityState={{ busy, disabled: incrementDisabled }}
        disabled={incrementDisabled}
        onPress={onIncrement}
        style={({ pressed }) => [
          styles.button,
          { borderColor: theme.accent },
          pressed && styles.pressed,
          incrementDisabled && styles.disabled,
        ]}>
        <Text color={theme.accent} style={styles.symbol} variant="label">
          +
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  button: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  symbol: { fontSize: 18, lineHeight: 22 },
  count: { minWidth: 38, textAlign: 'center', fontVariant: ['tabular-nums'] },
  pressed: { backgroundColor: 'rgba(255,255,255,0.07)' },
  disabled: { opacity: 0.4 },
});
