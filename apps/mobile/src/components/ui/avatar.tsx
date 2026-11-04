import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';

import { colors, gradients, radii } from '@/theme';

type AvatarProps = {
  source?: ImageSourcePropType | string;
  name: string;
  size?: number;
  badge?: ReactNode;
};

export function Avatar({ badge, name, size = 56, source }: AvatarProps) {
  const imageSource = typeof source === 'string' ? { uri: source } : source;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();

  return (
    <View style={{ height: size + 8, width: size + 8 }}>
      <MotiView
        from={{ rotate: '0deg' }}
        animate={{ rotate: '0deg' }}
        style={[styles.ring, { borderRadius: (size + 8) / 2, height: size + 8, width: size + 8 }]}>
        <LinearGradient colors={gradients.primary} style={StyleSheet.absoluteFill} />
      </MotiView>
      <View style={[styles.imageFrame, { height: size, left: 4, top: 4, width: size }]}>
        {imageSource ? (
          <Image accessibilityLabel={`Foto de ${name}`} source={imageSource} style={styles.image} />
        ) : (
          <View style={styles.initials}>
            <Text style={[styles.initialsText, { fontSize: Math.max(16, size * 0.32) }]}>{initials}</Text>
          </View>
        )}
      </View>
      {badge ? <View style={styles.badge}>{badge}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { overflow: 'hidden', position: 'absolute' },
  imageFrame: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.deepNavy,
    borderRadius: radii.pill,
    borderWidth: 2,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
  },
  image: { height: '100%', width: '100%' },
  initials: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSelected,
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  initialsText: { color: colors.primary, fontWeight: '700' },
  badge: { bottom: 0, position: 'absolute', right: -2 },
});
