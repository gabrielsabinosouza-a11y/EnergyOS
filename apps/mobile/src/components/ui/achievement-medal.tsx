import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';

import { colors, radii, typography } from '@/theme';
import { PressableScale } from './pressable-scale';
import { ProgressBar } from './progress-bar';

type AchievementMedalProps = {
  title: string;
  icon: ReactNode;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  locked?: boolean;
  progress?: number;
  onPress?: () => void;
};

const rarityColors = {
  common: '#A8B4C7',
  rare: colors.primary,
  epic: colors.purple,
  legendary: colors.amber,
} as const;

export function AchievementMedal({
  icon,
  locked = false,
  onPress,
  progress = 1,
  rarity = 'rare',
  title,
}: AchievementMedalProps) {
  const accent = locked ? '#79869A' : rarityColors[rarity];
  const content = (
    <View style={styles.content}>
      <View style={[styles.medal, { borderColor: `${accent}88` }]}>
        <LinearGradient
          colors={locked ? ['#263346', '#172335'] : [`${accent}38`, `${accent}0A`]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.medalHighlight, { borderColor: `${accent}50` }]}>
          <Text style={[styles.icon, locked && styles.lockedIcon]}>{icon}</Text>
        </View>
        {locked ? (
          <View style={styles.lockOverlay}>
            <Text style={styles.lockText}>🔒</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={2} style={styles.title}>{title}</Text>
      {locked ? (
        <View style={styles.progress}>
          <ProgressBar color={accent} progress={progress} height={4} />
          <Text style={styles.progressLabel}>{Math.round(Math.max(0, Math.min(1, progress)) * 100)}%</Text>
        </View>
      ) : (
        <View style={styles.tierDots}>
          {[0, 1, 2].map((dot) => (
            <View key={dot} style={[styles.dot, { backgroundColor: dot === 0 ? accent : 'rgba(255,255,255,0.16)' }]} />
          ))}
        </View>
      )}
    </View>
  );

  return onPress ? (
    <PressableScale
      accessibilityLabel={`${title}${locked ? ', bloqueada' : ''}`}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.container}>
      {content}
    </PressableScale>
  ) : <MotiView
    accessibilityLabel={`${title}${locked ? ', bloqueada' : ''}`}
    style={styles.container}
    from={{ opacity: 0, scale: 0.94 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ type: 'spring', damping: 18, stiffness: 240 }}>
    {content}
  </MotiView>;
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', minHeight: 140, width: 112 },
  content: { alignItems: 'center', gap: 8, width: '100%' },
  medal: {
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 76,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 76,
  },
  medalHighlight: {
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  icon: { color: colors.text, fontSize: 30 },
  lockedIcon: { opacity: 0.45 },
  lockOverlay: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  lockText: { fontSize: 17 },
  title: { ...typography.caption, color: colors.textSecondary, minHeight: 30, textAlign: 'center' },
  progress: { alignItems: 'center', flexDirection: 'row', gap: 7, width: '100%' },
  progressLabel: { color: colors.textMuted, fontSize: 10, fontVariant: ['tabular-nums'], width: 28 },
  tierDots: { flexDirection: 'row', gap: 4 },
  dot: { borderRadius: radii.pill, height: 5, width: 5 },
});
