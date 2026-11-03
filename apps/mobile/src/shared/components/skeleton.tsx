import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function Skeleton({ style, ...props }: ViewProps) {
  const theme = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ backgroundColor: theme.surfaceHover, borderRadius: 10 }, style]}
      {...props}
    />
  );
}
