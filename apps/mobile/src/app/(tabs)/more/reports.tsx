import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ApiError, api } from '@/shared/api';
import { Card, EmptyState, ErrorState, Screen, Text } from '@/shared/components';
import { getProductDate } from '@/shared/date';
import { useTheme } from '@/hooks/use-theme';

type Report = {
  checkins: Array<{ checkinDate: string; energyScore?: number; sleepHours?: number; studyMinutes?: number }>;
  completions: Array<{ date: string; completed: number; total: number }>;
  streakInfo: { currentStreak: number; bestStreak: number; totalDays: number };
  weeklyComparison: {
    thisWeek: { sleep: number; study: number; tasks: number };
    lastWeek: { sleep: number; study: number; tasks: number };
  };
};

function errorText(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível carregar seu relatório.';
}

export default function ReportsScreen() {
  const theme = useTheme();
  const [report, setReport] = useState<Report | null>(null);
  const [calendar, setCalendar] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const date = getProductDate();
      const [reportData, calendarData] = await Promise.all([
        api.get<Report>('/api/relatorio?days=30'),
        api.get<{ days: Record<string, string> }>(`/api/streak-calendar?year=${date.slice(0, 4)}&month=${Number(date.slice(5, 7)) - 1}`),
      ]);
      setReport(reportData);
      setCalendar(calendarData.days);
      setError('');
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const weekly = report?.weeklyComparison;
  const loggedDays = calendar ? Object.values(calendar).filter((value) => value === 'success' || value === 'protected').length : 0;

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
        <Text color={theme.purple} variant="eyebrow">OLHE PARA O CAMINHO</Text>
        <Text variant="title">Relatórios</Text>
        <Text color={theme.textSecondary}>Uma visão recente da sua consistência e rotina.</Text>
      </View>
      {error ? <ErrorState description={error} onRetry={() => void load()} title="Relatório indisponível" /> : null}
      {report ? (
        <>
          <View style={styles.stats}>
            <Card style={styles.stat}><Text color={theme.textSecondary} variant="caption">SEQUÊNCIA ATUAL</Text><Text color={theme.orange} variant="heading">{report.streakInfo.currentStreak} dias</Text></Card>
            <Card style={styles.stat}><Text color={theme.textSecondary} variant="caption">MELHOR SEQUÊNCIA</Text><Text color={theme.purple} variant="heading">{report.streakInfo.bestStreak} dias</Text></Card>
          </View>
          <Card style={styles.card}>
            <Text variant="sectionTitle">Esta semana</Text>
            <Text color={theme.textSecondary}>Sono médio: {weekly?.thisWeek.sleep ?? 0} h</Text>
            <Text color={theme.textSecondary}>Estudo: {weekly?.thisWeek.study ?? 0} min</Text>
            <Text color={theme.textSecondary}>Tarefas concluídas: {weekly?.thisWeek.tasks ?? 0}%</Text>
          </Card>
          <Card style={styles.card}>
            <Text variant="sectionTitle">Últimos 30 dias</Text>
            <Text color={theme.textSecondary}>{report.checkins.length} check-ins · {report.completions.length} dias com tarefas</Text>
            <Text color={theme.green}>Dias protegidos ou concluídos no mês: {loggedDays}</Text>
          </Card>
          {report.checkins.length === 0 ? <EmptyState description="Seus check-ins aparecerão aqui conforme você acompanha sua energia." title="Ainda não há registros" /> : null}
        </>
      ) : loading ? <Text color={theme.textSecondary}>Carregando seu relatório…</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 10, paddingTop: 8 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, gap: 6 },
  card: { gap: 10 },
});
