import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ApiError, api } from '@/shared/api';
import { Card, ErrorState, Screen, Text } from '@/shared/components';
import { useTheme } from '@/hooks/use-theme';

type LeagueEntry = {
  id: number;
  profileId: string;
  weeklyXP: number;
  rank: number;
  profile?: { displayName: string };
};

type LeagueSnapshot = {
  currentTier: string;
  weekStart: string;
  weekEnd: string;
  members: LeagueEntry[];
  userRank: number;
  promotionZoneEnd: number;
  demotionZoneStart: number;
};

function errorText(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível carregar a liga.';
}

export default function LeagueScreen() {
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<LeagueSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setSnapshot(await api.get<LeagueSnapshot>('/api/league-new'));
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
        <Text color={theme.orange} variant="eyebrow">DESAFIO SEMANAL</Text>
        <Text variant="title">Liga</Text>
        <Text color={theme.textSecondary}>Seu foco e consistência contam para a classificação.</Text>
      </View>
      {error ? <ErrorState description={error} onRetry={() => void load()} title="Liga indisponível" /> : null}
      {snapshot ? (
        <>
          <Card style={styles.summary}>
            <Text color={theme.orange} variant="heading">{snapshot.currentTier}</Text>
            <Text color={theme.textSecondary}>Semana iniciada em {snapshot.weekStart}</Text>
            <Text color={theme.purple}>Sua posição: {snapshot.userRank > 0 ? `#${snapshot.userRank}` : 'aguardando'}</Text>
          </Card>
          <Text variant="sectionTitle">Classificação</Text>
          {snapshot.members.map((entry) => (
            <Card key={entry.profileId} style={[styles.entry, entry.rank === snapshot.userRank && { borderColor: theme.accent }]}>
              <Text color={theme.orange} variant="heading">#{entry.rank}</Text>
              <View style={styles.member}>
                <Text variant="label">{entry.profile?.displayName || 'Pessoa EnergyOS'}{entry.rank === snapshot.userRank ? ' · você' : ''}</Text>
                <Text color={theme.textSecondary}>Progresso desta semana</Text>
              </View>
              <Text color={theme.purple} variant="label">{entry.weeklyXP} XP</Text>
            </Card>
          ))}
        </>
      ) : loading ? <Text color={theme.textSecondary}>Carregando classificação…</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 10, paddingTop: 8 },
  summary: { alignItems: 'center', gap: 8 },
  entry: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  member: { flex: 1, gap: 4 },
});
