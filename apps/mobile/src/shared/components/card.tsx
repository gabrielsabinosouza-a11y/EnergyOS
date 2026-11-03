import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function Card({ style, ...props }: ViewProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderRadius: 20,
          borderWidth: 1,
          padding: 18,
        },
        style,
      ]}
      {...props}
    />
  );
}
