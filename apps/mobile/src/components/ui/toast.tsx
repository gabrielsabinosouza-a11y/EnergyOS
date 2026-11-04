import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatePresence, MotiView } from 'moti';

import { colors, radii, shadows, typography } from '@/theme';

type ToastProps = {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  type?: 'success' | 'error' | 'info';
  duration?: number;
};

const accents = { success: colors.success, error: colors.danger, info: colors.primary };

export function Toast({
  duration = 3500,
  message,
  onDismiss,
  type = 'success',
  visible,
}: ToastProps) {
  useEffect(() => {
    if (!visible) return undefined;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss, visible]);

  return (
    <View pointerEvents="box-none" style={styles.position}>
      <AnimatePresence>
        {visible ? (
          <MotiView
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: 10 }}
            transition={{ type: 'timing', duration: 200 }}
            style={[styles.toast, { borderLeftColor: accents[type] }]}>
            <View style={[styles.dot, { backgroundColor: accents[type] }]} />
            <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>
          </MotiView>
        ) : null}
      </AnimatePresence>
    </View>
  );
}

const styles = StyleSheet.create({
  position: { bottom: 16, left: 16, position: 'absolute', right: 16, zIndex: 30 },
  toast: {
    ...shadows.floating,
    alignItems: 'center',
    backgroundColor: '#111E30',
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dot: { borderRadius: radii.pill, height: 8, width: 8 },
  message: { ...typography.body, color: colors.text, flex: 1 },
});
