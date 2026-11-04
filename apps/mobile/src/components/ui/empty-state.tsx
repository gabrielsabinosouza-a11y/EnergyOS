import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/theme';
import { GradientButton } from './gradient-button';

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ actionLabel, description, icon, onAction, title }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <GradientButton onPress={onAction} title={actionLabel} variant="secondary" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 10, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 28 },
  icon: { alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { ...typography.heading, color: colors.text, textAlign: 'center' },
  description: { ...typography.body, color: colors.textSecondary, maxWidth: 300, textAlign: 'center' },
  action: { marginTop: 6, minWidth: 150 },
});
