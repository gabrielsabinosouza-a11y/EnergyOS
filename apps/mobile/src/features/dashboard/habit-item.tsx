import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { HabitCounter, Text } from '@/shared/components';
import type { DailyHabit } from './types';

type HabitItemProps = {
  habit: DailyHabit;
  busy?: boolean;
  disabled?: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
};

export function HabitItem({
  habit,
  busy = false,
  disabled = false,
  onDecrement,
  onIncrement,
}: HabitItemProps) {
  const theme = useTheme();
  const completed = habit.completedCount >= habit.dailyTarget;

  return (
    <View style={[styles.row, { borderTopColor: theme.border }]}>
      <View style={styles.copy}>
        <Text color={completed ? theme.textMuted : theme.text} variant="label">
          {habit.title}
        </Text>
      </View>
      <HabitCounter
        busy={busy}
        count={habit.completedCount}
        disabled={disabled}
        habitName={habit.title}
        onDecrement={onDecrement}
        onIncrement={onIncrement}
        target={habit.dailyTarget}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
  },
  copy: { flex: 1, gap: 4 },
});
