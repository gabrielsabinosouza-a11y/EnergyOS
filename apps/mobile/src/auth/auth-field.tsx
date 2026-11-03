import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Text } from '@/shared/components';

type AuthFieldProps = TextInputProps & {
  label: string;
};

export function AuthField({ label, style, ...props }: AuthFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        placeholderTextColor={theme.textMuted}
        selectionColor={theme.accent}
        style={[
          styles.input,
          {
            backgroundColor: theme.surfaceHover,
            borderColor: theme.border,
            color: theme.text,
          },
          style,
        ]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  input: {
    borderRadius: 13,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 15,
  },
});
