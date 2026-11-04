import type { ViewStyle } from 'react-native';

const dark = {
  text: '#E8F4FF',
  textSecondary: 'rgba(232,244,255,0.72)',
  textMuted: 'rgba(232,244,255,0.48)',
  background: '#060D1A',
  backgroundElevated: '#0B1424',
  surface: 'rgba(255,255,255,0.06)',
  surfaceHover: 'rgba(255,255,255,0.09)',
  backgroundElement: 'rgba(255,255,255,0.06)',
  backgroundSelected: 'rgba(113,212,255,0.12)',
  accent: '#71D4FF',
  accentBg: 'rgba(113,212,255,0.12)',
  purple: '#B69CFF',
  purpleBg: 'rgba(182,156,255,0.12)',
  green: '#4ADE80',
  orange: '#FFD76B',
  red: '#F87171',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.16)',
} as const;

const light = {
  text: '#1E293B',
  textSecondary: 'rgba(30,41,59,0.70)',
  textMuted: 'rgba(30,41,59,0.45)',
  background: '#F8FAFC',
  backgroundElevated: '#FFFFFF',
  surface: 'rgba(255,255,255,0.95)',
  surfaceHover: 'rgba(0,0,0,0.04)',
  backgroundElement: 'rgba(255,255,255,0.95)',
  backgroundSelected: 'rgba(2,132,199,0.10)',
  accent: '#0284C7',
  accentBg: 'rgba(2,132,199,0.10)',
  purple: '#7C3AED',
  purpleBg: 'rgba(124,58,237,0.08)',
  green: '#16A34A',
  orange: '#C77700',
  red: '#DC2626',
  border: 'rgba(0,0,0,0.10)',
  borderStrong: 'rgba(0,0,0,0.18)',
} as const;

export const Colors = { light, dark } as const;
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const colors = {
  ...dark,
  deepNavy: '#060D1A',
  navy: '#0B1424',
  glass: 'rgba(255,255,255,0.06)',
  glassStrong: 'rgba(255,255,255,0.09)',
  primary: '#71D4FF',
  amber: '#FFD76B',
  success: '#4ADE80',
  danger: '#F87171',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' as const },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  mono: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const },
} as const;

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 8,
  } satisfies ViewStyle,
  floating: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 12,
  } satisfies ViewStyle,
} as const;

export const gradients = {
  primary: ['#71D4FF', '#4E9EFF'] as const,
  purple: ['#B69CFF', '#7C5CFF'] as const,
  amber: ['#FFE29A', '#FFAE46'] as const,
  glassBorder: ['rgba(113,212,255,0.35)', 'rgba(255,255,255,0.08)'] as const,
  hero: ['rgba(6,13,26,0.05)', 'rgba(6,13,26,0.82)'] as const,
};

export const motion = {
  duration: { fast: 150, normal: 250, slow: 400 },
  spring: {
    snappy: { damping: 22, stiffness: 380 },
    soft: { damping: 24, stiffness: 190 },
    bouncy: { damping: 14, stiffness: 240 },
  },
} as const;

export const Spacing = {
  half: 2,
  one: spacing.xxs,
  two: spacing.xs,
  threeHalf: spacing.sm,
  three: spacing.md,
  four: spacing.lg,
  five: spacing.xl,
  six: 64,
} as const;

export const Radii = {
  small: 8,
  medium: radii.sm,
  large: 20,
  pill: radii.pill,
} as const;
