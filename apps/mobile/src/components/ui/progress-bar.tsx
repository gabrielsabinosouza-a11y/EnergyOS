import { StyleSheet, View } from 'react-native';
import { MotiView } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';

import { colors, radii } from '@/theme';

type ProgressBarProps = {
  progress: number;
  color?: string;
  trackColor?: string;
  height?: number;
};

export function ProgressBar({
  color = colors.primary,
  height = 8,
  progress,
  trackColor = 'rgba(255,255,255,0.10)',
}: ProgressBarProps) {
  const reducedMotion = useReducedMotion();
  const normalizedProgress = Math.min(1, Math.max(0, progress));

  return (
    <View
      accessibilityLabel={`Progresso: ${Math.round(normalizedProgress * 100)}%`}
      accessibilityRole="progressbar"
      style={[styles.track, { backgroundColor: trackColor, height }]}>
      <MotiView
        from={{ opacity: 0, scaleX: reducedMotion ? normalizedProgress : 0 }}
        animate={{ opacity: 1, scaleX: normalizedProgress }}
        transition={{ type: 'timing', duration: reducedMotion ? 0 : 400 }}
        style={[
          styles.fill,
          { backgroundColor: color, height, transformOrigin: 'left center' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: radii.pill, overflow: 'hidden', width: '100%' },
  fill: { borderRadius: radii.pill, left: 0, position: 'absolute', right: 0, top: 0 },
});
