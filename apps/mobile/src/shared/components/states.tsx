import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Button } from './button';
import { Card } from './card';
import { Text } from './text';

type StateProps = {
  title: string;
  description: string;
};

export function EmptyState({ description, title }: StateProps) {
  const theme = useTheme();

  return (
    <Card style={styles.card}>
      <View style={[styles.mark, { backgroundColor: theme.accentBg }]}>
        <Text color={theme.accent} variant="heading">
          ✦
        </Text>
      </View>
      <Text variant="sectionTitle">{title}</Text>
      <Text color={theme.textSecondary} style={styles.copy}>
        {description}
      </Text>
    </Card>
  );
}

export function ErrorState({
  description,
  onRetry,
  title,
}: StateProps & { onRetry?: () => void }) {
  const theme = useTheme();

  return (
    <Card style={styles.card}>
      <Text color={theme.red} variant="eyebrow">
        NÃO FOI POSSÍVEL CARREGAR
      </Text>
      <Text variant="sectionTitle">{title}</Text>
      <Text color={theme.textSecondary} style={styles.copy}>
        {description}
      </Text>
      {onRetry ? <Button onPress={onRetry} title="Tentar novamente" variant="secondary" /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'flex-start', gap: 12 },
  mark: { alignItems: 'center', borderRadius: 14, height: 42, justifyContent: 'center', width: 42 },
  copy: { maxWidth: 420 },
});
