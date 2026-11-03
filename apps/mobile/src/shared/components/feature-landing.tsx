import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Card } from './card';
import { Screen } from './screen';
import { Text } from './text';

type FeatureLandingProps = {
  eyebrow: string;
  title: string;
  description: string;
  detail: string;
};

export function FeatureLanding({ description, detail, eyebrow, title }: FeatureLandingProps) {
  const theme = useTheme();

  return (
    <Screen>
      <View style={styles.heading}>
        <Text color={theme.accent} variant="eyebrow">
          {eyebrow}
        </Text>
        <Text variant="title">{title}</Text>
        <Text color={theme.textSecondary}>{description}</Text>
      </View>
      <Card style={styles.card}>
        <Text color={theme.purple} variant="eyebrow">
          ENERGYOS
        </Text>
        <Text variant="heading">Sua experiência, em um só lugar.</Text>
        <Text color={theme.textSecondary}>{detail}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 10, paddingTop: 8 },
  card: { gap: 12, paddingVertical: 22 },
});
