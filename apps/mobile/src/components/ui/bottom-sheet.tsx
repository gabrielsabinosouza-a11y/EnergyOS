import { useEffect, type PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, motion, radii, shadows, typography } from '@/theme';
import { supportsBlur } from './platform';

type BottomSheetProps = PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
}>;

export function BottomSheet({ children, onClose, title, visible }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(420);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, reducedMotion ? { damping: 24, stiffness: 220, duration: 0 } : motion.spring.soft);
    }
  }, [reducedMotion, translateY, visible]);

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 120 || event.velocityY > 900) {
        translateY.value = withTiming(420, { duration: reducedMotion ? 0 : 180 });
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, motion.spring.soft);
      }
    });

  if (!visible) return null;

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      transparent
      visible={visible}
      statusBarTranslucent>
      <View style={styles.overlay}>
        {supportsBlur ? (
          <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
        ) : null}
        <Pressable
          accessibilityLabel="Fechar painel"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }, sheetStyle]}>
            <View style={styles.handleArea}>
              <View style={styles.handle} />
            </View>
            <View style={styles.heading}>
              <Text style={styles.title}>{title}</Text>
              <Pressable accessibilityLabel="Fechar" accessibilityRole="button" onPress={onClose} hitSlop={12}>
                <Text style={styles.close}>×</Text>
              </Pressable>
            </View>
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(3,8,17,0.62)', flex: 1, justifyContent: 'flex-end' },
  sheet: {
    ...shadows.floating,
    backgroundColor: '#0B1424',
    borderColor: colors.border,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    maxHeight: '82%',
    minHeight: 180,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  handleArea: { alignItems: 'center', height: 26, justifyContent: 'center' },
  handle: { backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: radii.pill, height: 4, width: 38 },
  heading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  title: { ...typography.heading, color: colors.text },
  close: { color: colors.textSecondary, fontSize: 28, lineHeight: 30 },
});
