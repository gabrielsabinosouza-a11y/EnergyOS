import { useEffect, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { Text } from '@/shared/components';

const VIEWBOX_SIZE = 260;
const RING_RADIUS = 112;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const MIN_DURATION = 10;
const MAX_DURATION = 120;
const DURATION_STEP = 5;

type FocusTimerProps = {
  durationMinutes: number;
  remainingSeconds: number;
  elapsedProgress: number;
  active: boolean;
  paused: boolean;
  gracePeriod: boolean;
  graceSecondsRemaining: number;
  extinguished: boolean;
  onDurationChange: (minutes: number) => void;
};

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function FocusTimer({
  active,
  durationMinutes,
  elapsedProgress,
  onDurationChange,
  paused,
  gracePeriod,
  graceSecondsRemaining,
  extinguished,
  remainingSeconds,
}: FocusTimerProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [pulse] = useState(() => new Animated.Value(1));
  const shake = useSharedValue(0);
  const fade = useSharedValue(0);
  const ringSize = Math.min(280, Math.max(200, width - 104));
  const idleProgress = Math.max(
    0.04,
    (durationMinutes - MIN_DURATION) / (MAX_DURATION - MIN_DURATION),
  );
  const progress = active ? Math.min(1, Math.max(0, elapsedProgress)) : idleProgress;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);
  const markerAngle = progress * 2 * Math.PI - Math.PI / 2;
  const markerX = VIEWBOX_SIZE / 2 + RING_RADIUS * Math.cos(markerAngle);
  const markerY = VIEWBOX_SIZE / 2 + RING_RADIUS * Math.sin(markerAngle);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 1350,
          toValue: 1.07,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: 1350,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  useEffect(() => {
    if (!extinguished) {
      fade.value = withTiming(0, { duration: 180 });
      shake.value = 0;
      return;
    }
    fade.value = withTiming(1, { duration: 700 });
    shake.value = withSequence(
      withTiming(-4, { duration: 55 }),
      withTiming(4, { duration: 55 }),
      withTiming(-3, { duration: 55 }),
      withTiming(3, { duration: 55 }),
      withTiming(0, { duration: 75 }),
    );
  }, [extinguished, fade, shake]);

  const extinguishedStyle = useAnimatedStyle(() => ({
    opacity: 1 - fade.value * 0.45,
    transform: [{ translateX: shake.value }, { scale: 1 - fade.value * 0.04 }],
  }));

  return (
    <View style={styles.container}>
      <View
        accessibilityLabel={gracePeriod
          ? `Período de cancelamento: ${graceSecondsRemaining} segundos restantes`
          : paused ? 'Sessão de foco pausada' : 'Progresso da sessão de foco'}
        style={{ height: ringSize, width: ringSize }}>
        <Svg height={ringSize} viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`} width={ringSize}>
          <Defs>
            <LinearGradient id="focusRing" x1="0%" x2="100%" y1="0%" y2="100%">
              <Stop offset="0%" stopColor={theme.purple} />
              <Stop offset="100%" stopColor="#7924b5" />
            </LinearGradient>
            <LinearGradient id="focusFlame" x1="0%" x2="100%" y1="0%" y2="100%">
              <Stop offset="0%" stopColor="#e2a8ff" />
              <Stop offset="55%" stopColor="#aa52ef" />
              <Stop offset="100%" stopColor="#7023bd" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={VIEWBOX_SIZE / 2}
            cy={VIEWBOX_SIZE / 2}
            fill="none"
            r={RING_RADIUS}
            stroke={theme.border}
            strokeWidth={8}
          />
          <Circle
            cx={VIEWBOX_SIZE / 2}
            cy={VIEWBOX_SIZE / 2}
            fill="none"
            r={RING_RADIUS}
            rotation={-90}
            origin={`${VIEWBOX_SIZE / 2}, ${VIEWBOX_SIZE / 2}`}
            stroke={extinguished ? '#77818d' : 'url(#focusRing)'}
            strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            strokeWidth={8}
          />
          <Circle cx={markerX} cy={markerY} fill="#7924b5" r={9} stroke="#d7a4ff" strokeWidth={3} />
          <Path
            d="M130 55 C126 77 103 83 105 106 C87 121 91 145 109 155 C102 173 116 191 131 201 C126 183 144 178 148 161 C169 147 165 125 148 113 C158 93 148 75 136 68 C140 84 128 90 125 99 C119 82 137 72 130 55Z"
            fill={extinguished ? '#77818d' : 'url(#focusFlame)'}
            opacity={0.96}
          />
          <Path
            d="M130 103 C122 116 112 122 116 137 C119 147 128 151 126 165 C139 156 151 145 144 132 C141 124 133 119 130 103Z"
            fill={extinguished ? '#a7afb9' : '#f1d8ff'}
            opacity={0.72}
          />
        </Svg>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flameGlow,
            {
              backgroundColor: '#9b43d8',
              height: ringSize * 0.5,
              left: ringSize * 0.25,
              top: ringSize * 0.25,
              transform: [{ scale: pulse }],
              width: ringSize * 0.5,
            },
          ]}
        />
        {extinguished ? (
          <Reanimated.View
            pointerEvents="none"
            style={[
              styles.deadEnergy,
              {
                height: ringSize * 0.3,
                left: ringSize * 0.35,
                top: ringSize * 0.35,
                width: ringSize * 0.3,
              },
              extinguishedStyle,
            ]}
          />
        ) : null}
      </View>

      <Text
        accessibilityLabel={
          active
            ? gracePeriod
              ? `Período de cancelamento, ${graceSecondsRemaining} segundos restantes`
              : `Tempo restante: ${formatCountdown(remainingSeconds)}`
            : `${durationMinutes} minutos de foco`
        }
        color={theme.text}
        style={styles.time}
        variant="title">
        {active ? formatCountdown(remainingSeconds) : durationMinutes}
      </Text>
      <Text color={theme.textMuted} style={styles.unit} variant="caption">
        {active
          ? paused ? 'SESSÃO PAUSADA' : gracePeriod ? 'PERÍODO DE CANCELAMENTO' : 'TEMPO RESTANTE'
          : 'MINUTOS DE FOCO'}
      </Text>

      {!active ? (
        <View style={styles.durationControls}>
          <Pressable
            accessibilityLabel="Diminuir duração em cinco minutos"
            accessibilityRole="button"
            disabled={durationMinutes <= MIN_DURATION}
            onPress={() => onDurationChange(Math.max(MIN_DURATION, durationMinutes - DURATION_STEP))}
            style={({ pressed }) => [
              styles.adjustButton,
              { borderColor: theme.border, backgroundColor: theme.surfaceHover },
              pressed && styles.pressed,
              durationMinutes <= MIN_DURATION && styles.disabled,
            ]}>
            <Text color={theme.text} style={styles.adjustSymbol} variant="label">−</Text>
          </Pressable>
          <Text color={theme.textSecondary} variant="caption">ajustar duração</Text>
          <Pressable
            accessibilityLabel="Aumentar duração em cinco minutos"
            accessibilityRole="button"
            disabled={durationMinutes >= MAX_DURATION}
            onPress={() => onDurationChange(Math.min(MAX_DURATION, durationMinutes + DURATION_STEP))}
            style={({ pressed }) => [
              styles.adjustButton,
              { borderColor: theme.border, backgroundColor: theme.surfaceHover },
              pressed && styles.pressed,
              durationMinutes >= MAX_DURATION && styles.disabled,
            ]}>
            <Text color={theme.text} style={styles.adjustSymbol} variant="label">+</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  flameGlow: {
    borderRadius: 999,
    opacity: 0.12,
    position: 'absolute',
  },
  deadEnergy: {
    backgroundColor: '#7b8490',
    borderRadius: 999,
    opacity: 0.18,
    position: 'absolute',
  },
  time: { fontSize: 42, fontVariant: ['tabular-nums'], lineHeight: 50, marginTop: 4 },
  unit: { letterSpacing: 1.3 },
  durationControls: { alignItems: 'center', flexDirection: 'row', gap: 14, marginTop: 8 },
  adjustButton: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  adjustSymbol: { fontSize: 23, lineHeight: 28 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
});
