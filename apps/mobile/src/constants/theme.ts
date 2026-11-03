import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1e293b',
    textSecondary: 'rgba(30,41,59,0.70)',
    textMuted: 'rgba(30,41,59,0.45)',
    background: '#f8fafc',
    surface: 'rgba(255,255,255,0.95)',
    surfaceHover: 'rgba(0,0,0,0.04)',
    backgroundElement: 'rgba(255,255,255,0.95)',
    backgroundSelected: 'rgba(0,0,0,0.07)',
    accent: '#0284c7',
    accentBg: 'rgba(2,132,199,0.10)',
    purple: '#7c3aed',
    purpleBg: 'rgba(124,58,237,0.08)',
    green: '#16a34a',
    orange: '#ea580c',
    red: '#dc2626',
    border: 'rgba(0,0,0,0.10)',
    borderStrong: 'rgba(0,0,0,0.18)',
  },
  dark: {
    text: '#e7f4ff',
    textSecondary: 'rgba(231,244,255,0.70)',
    textMuted: 'rgba(231,244,255,0.42)',
    background: '#07111f',
    surface: 'rgba(13,27,45,0.78)',
    surfaceHover: 'rgba(255,255,255,0.05)',
    backgroundElement: 'rgba(13,27,45,0.78)',
    backgroundSelected: 'rgba(255,255,255,0.08)',
    accent: '#71d4ff',
    accentBg: 'rgba(113,212,255,0.08)',
    purple: '#b69cff',
    purpleBg: 'rgba(182,156,255,0.08)',
    green: '#4ade80',
    orange: '#ffb86b',
    red: '#f87171',
    border: 'rgba(255,255,255,0.09)',
    borderStrong: 'rgba(255,255,255,0.15)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  threeHalf: 12,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radii = {
  small: 8,
  medium: 12,
  large: 20,
  pill: 999,
} as const;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});
