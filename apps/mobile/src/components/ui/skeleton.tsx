import { StyleSheet, View, type ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';

import { colors, radii } from '@/theme';

type SkeletonProps = {
  style?: ViewStyle;
  radius?: number;
};

export function Skeleton({ radius = radii.md, style }: SkeletonProps) {
  const reducedMotion = useReducedMotion();

  return (
    <View style={[styles.track, { borderRadius: radius }, style]}>
      <MotiView
        from={{ opacity: 0.45 }}
        animate={{ opacity: reducedMotion ? 0.65 : 0.9 }}
        transition={reducedMotion ? undefined : { type: 'timing', duration: 850, loop: true, repeatReverse: true }}
        style={styles.shimmer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: colors.glassStrong, overflow: 'hidden' },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
