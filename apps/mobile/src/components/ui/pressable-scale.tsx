import type { PropsWithChildren } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { motion } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = PropsWithChildren<
  Omit<PressableProps, 'children' | 'style'> & {
    style?: StyleProp<ViewStyle>;
    haptic?: boolean;
  }
>;

export function PressableScale({
  children,
  haptic = false,
  onPress,
  onPressIn,
  onPressOut,
  style,
  ...props
}: PressableScaleProps) {
  const reducedMotion = useReducedMotion();
  const pressed = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pressed.get() < 1 ? 0.92 : 1,
    transform: [{ scale: pressed.get() }],
  }));

  return (
    <AnimatedPressable
      {...props}
      onPress={(event) => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(event);
      }}
      onPressIn={(event) => {
        pressed.set(reducedMotion ? 1 : withSpring(0.97, motion.spring.snappy));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.set(withSpring(1, motion.spring.snappy));
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}>
      {children}
    </AnimatedPressable>
  );
}
