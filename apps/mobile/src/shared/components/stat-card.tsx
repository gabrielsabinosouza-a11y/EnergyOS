import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Card } from './card';
import { Text } from './text';

type StatCardProps = {
  label: string;
  value: string;
  color: string;
  icon?: ImageSourcePropType;
};

export function StatCard({ color, icon, label, value }: StatCardProps) {
  const theme = useTheme();

  return (
    <Card style={styles.card}>
      <View style={styles.labelRow}>
        {icon ? <Image resizeMode="contain" source={icon} style={styles.icon} /> : null}
        <Text color={theme.textSecondary} numberOfLines={1} variant="caption">
          {label}
        </Text>
      </View>
      <Text color={color} numberOfLines={1} style={styles.value} variant="heading">
        {value}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, gap: 8, minWidth: 0, padding: 14 },
  labelRow: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 24 },
  icon: { height: 22, width: 22 },
  value: { fontSize: 20, lineHeight: 26 },
});
