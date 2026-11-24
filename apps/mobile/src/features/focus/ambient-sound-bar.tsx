import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/hooks/use-theme';
import { Text } from '@/shared/components';
import { AMBIENT_SOUNDS, useAmbientMix } from './ambient';

const SOUND_ICONS = {
  rain: { ios: 'cloud.rain', android: 'water_drop', web: 'water_drop' },
  fireplace: { ios: 'flame', android: 'local_fire_department', web: 'local_fire_department' },
} as const;

/** Compact ambient-sound toggles for the focus card (Chuva / Lareira + mute). */
export function AmbientSoundBar() {
  const theme = useTheme();
  const { mix, hydrated, toggleSound, toggleMute } = useAmbientMix();

  if (!hydrated) return null;

  const anyOn = mix.enabled.length > 0 && !mix.muted;

  return (
    <View style={styles.row} accessibilityLabel="Sons ambiente">
      {AMBIENT_SOUNDS.map((def) => {
        const on = mix.enabled.includes(def.id);
        return (
          <Pressable
            key={def.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Som de ${def.label.toLowerCase()}`}
            onPress={() => toggleSound(def.id)}
            style={({ pressed }) => [
              styles.chip,
              {
                borderColor: on ? theme.accent : theme.border,
                backgroundColor: on ? theme.accentBg : theme.surface,
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <SymbolView
              name={SOUND_ICONS[def.id as keyof typeof SOUND_ICONS] ?? SOUND_ICONS.rain}
              size={12}
              tintColor={on ? theme.accent : theme.textMuted}
            />
            <Text variant="caption" color={on ? theme.accent : theme.textMuted}>
              {def.label}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mix.muted ? 'Ativar som ambiente' : 'Silenciar som ambiente'}
        accessibilityState={{ selected: mix.muted }}
        onPress={toggleMute}
        style={({ pressed }) => [
          styles.chip,
          {
            borderColor: anyOn ? theme.accent : theme.border,
            backgroundColor: 'transparent',
            opacity: pressed ? 0.7 : 1,
          },
        ]}>
        <SymbolView
          name={{
            ios: mix.muted ? 'speaker.slash' : 'speaker.wave.2',
            android: mix.muted ? 'volume_off' : 'volume_up',
            web: mix.muted ? 'volume_off' : 'volume_up',
          }}
          size={13}
          tintColor={anyOn ? theme.accent : theme.textMuted}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
