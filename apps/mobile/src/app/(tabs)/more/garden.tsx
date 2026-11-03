import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ApiError, api } from '@/shared/api';
import { Card, EmptyState, ErrorState, Screen, Text } from '@/shared/components';
import { useTheme } from '@/hooks/use-theme';

type GardenEntry = {
  id: number;
  energyType: string;
  durationMinutes: number;
  reward: number;
  plantedAt: string;
  growthStage: string;
  status: string;
};

function errorText(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível carregar seu jardim.';
}

export default function GardenScreen() {
  const theme = useTheme();
  const [entries, setEntries] = useState<GardenEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await api.get<{ entries: GardenEntry[] }>('/api/garden');
      setEntries(result.entries);
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
        <Text color={theme.green} variant="eyebrow">SEU PROGRESSO FLORESCE</Text>
        <Text variant="title">Jardim</Text>
        <Text color={theme.textSecondary}>Cada sessão concluída pode cultivar uma nova energia.</Text>
      </View>
      {error ? <ErrorState description={error} onRetry={() => void load()} title="Jardim indisponível" /> : null}
      {!loading && !error && entries.length === 0 ? (
        <EmptyState description="Complete sessões de foco para cultivar seu jardim." title="Seu jardim está esperando" />
      ) : null}
      <View style={styles.grid}>
        {entries.map((entry) => (
          <Card key={entry.id} style={styles.plant}>
            <Text color={theme.green} style={styles.emoji} variant="heading">✿</Text>
            <Text variant="label">{entry.energyType}</Text>
            <Text color={theme.textSecondary}>{entry.growthStage} · {entry.status}</Text>
            <Text color={theme.accent} variant="caption">{entry.durationMinutes} min · +{entry.reward} energia</Text>
            <Text color={theme.textMuted} variant="caption">{new Date(entry.plantedAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</Text>
          </Card>
        ))}
      </View>
      {loading ? <Text color={theme.textSecondary}>Carregando jardim…</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 10, paddingTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  plant: { alignItems: 'center', flexBasis: '47%', flexGrow: 1, gap: 8 },
  emoji: { fontSize: 36, lineHeight: 44 },
});
