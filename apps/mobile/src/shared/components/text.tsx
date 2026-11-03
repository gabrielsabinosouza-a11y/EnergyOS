import { Text as NativeText, type TextProps as NativeTextProps, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const variants = {
  title: { fontSize: 32, fontWeight: '700' as const, lineHeight: 38 },
  heading: { fontSize: 22, fontWeight: '700' as const, lineHeight: 29 },
  sectionTitle: { fontSize: 18, fontWeight: '700' as const, lineHeight: 25 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 23 },
  label: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 17 },
  eyebrow: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4, lineHeight: 16 },
} as const;

export type TextProps = NativeTextProps & {
  variant?: keyof typeof variants;
  color?: string;
};

export function Text({ color, style, variant = 'body', ...props }: TextProps) {
  const theme = useTheme();

  return (
    <NativeText
      style={[styles.base, variants[variant], { color: color ?? theme.text }, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: { includeFontPadding: false },
});
