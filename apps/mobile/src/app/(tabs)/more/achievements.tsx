import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ApiError, api } from '@/shared/api';
import { Button, Card, EmptyState, ErrorState, Screen, Text } from '@/shared/components';
import { useTheme } from '@/hooks/use-theme';

type Achievement = {
  id: string;
  title: string;
  description: string;
  category: string;
  thresholds: number[];
  currentValue: number;
  unlockedTier: number;
  justUnlocked: boolean;
  isFeatured: boolean;
};

function errorText(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível carregar as conquistas.';
}

export default function AchievementsScreen() {
  const theme = useTheme();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await api.get<{ achievements: Achievement[] }>('/api/achievements');
      setAchievements(result.achievements);
      setError('');
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function toggleFeatured(item: Achievement) {
    setBusyId(item.id);
    setError('');
    try {
      await api.patch('/api/achievements', { achievementId: item.id });
      await load();
    } catch (updateError) {
      setError(errorText(updateError));
    } finally {
      setBusyId('');
    }
  }

  async function acknowledge(item: Achievement) {
    setBusyId(item.id);
    try {
      await api.post('/api/achievements', { achievementId: item.id });
      setAchievements((current) => current.map((entry) => entry.id === item.id ? { ...entry, justUnlocked: false } : entry));
    } catch (updateError) {
      setError(errorText(updateError));
    } finally {
      setBusyId('');
    }
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          colors={[theme.accent]}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          refreshing={refreshing}
          tintColor={theme.accent}
        />
      }>
      <View style={styles.heading}>
        <Text color={theme.purple} variant="eyebrow">CADA PASSO CONTA</Text>
        <Text variant="title">Conquistas</Text>
        <Text color={theme.textSecondary}>Marcos e progresso registrados pela sua conta.</Text>
      </View>
      {error ? <ErrorState description={error} onRetry={() => void load()} title="Conquistas indisponíveis" /> : null}
      {!loading && achievements.length === 0 ? <EmptyState description="Continue seu ritmo. Novos marcos aparecerão aqui." title="Nenhuma conquista ainda" /> : null}
      {achievements.map((item) => {
        const nextThreshold = item.thresholds[item.unlockedTier] ?? item.thresholds.at(-1) ?? 0;
        const unlocked = item.unlockedTier > 0;
        return (
          <Card key={item.id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.copy}>
                <Text variant="label">{item.title}{unlocked ? ` · nível ${item.unlockedTier}` : ''}</Text>
                <Text color={theme.textSecondary}>{item.description}</Text>
              </View>
              {unlocked ? <Text color={theme.orange} variant="heading">✦</Text> : null}
            </View>
            <Text color={theme.textMuted} variant="caption">
              {item.currentValue}{nextThreshold ? ` / ${nextThreshold}` : ''} · {item.category}
            </Text>
            {item.justUnlocked ? <Button disabled={busyId === item.id} onPress={() => void acknowledge(item)} title="Marcar como vista" variant="secondary" /> : null}
            {unlocked ? <Button disabled={busyId === item.id} loading={busyId === item.id} onPress={() => void toggleFeatured(item)} title={item.isFeatured ? 'Remover destaque' : 'Destacar no perfil'} variant="quiet" /> : null}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 10, paddingTop: 8 },
  card: { gap: 10 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  copy: { flex: 1, gap: 5 },
});
