import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

import { ApiError, api } from '@/shared/api';
import { Button, Card, ErrorState, Screen, Skeleton, Text } from '@/shared/components';
import type { CheckinResponse, DashboardSnapshot, DashboardTask } from '@/features/dashboard/types';
import { useTheme } from '@/hooks/use-theme';

const ENERGY_OPTIONS = [1, 2, 3, 4, 5] as const;

function getErrorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Ocorreu um erro inesperado. Tente novamente.';
}

export default function TodayScreen() {
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [energyScore, setEnergyScore] = useState<number | null>(null);
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState('');
  const [taskPendingId, setTaskPendingId] = useState<number | null>(null);
  const [taskError, setTaskError] = useState('');

  const requestSnapshot = useCallback(() => api.get<DashboardSnapshot>('/api/dashboard'), []);

  const loadSnapshot = useCallback(async () => {
    try {
      const data = await requestSnapshot();
      setError('');
      setSnapshot(data);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestSnapshot]);

  useEffect(() => {
    let active = true;
    requestSnapshot()
      .then((data) => {
        if (!active) return;
        setError('');
        setSnapshot(data);
      })
      .catch((loadError: unknown) => {
        if (active) setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      active = false;
    };
  }, [requestSnapshot]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setError('');
    void loadSnapshot();
  }, [loadSnapshot]);

  async function saveCheckin() {
    if (energyScore === null || savingCheckin) return;
    setSavingCheckin(true);
    setCheckinMessage('');
    setError('');
    try {
      const result = await api.post<CheckinResponse>('/api/checkins', { energyScore });
      setCheckinMessage(
        `Registro de ${result.checkin.checkinDate} salvo. +${result.xpAwarded} XP e +${result.coinsAwarded} moedas.`,
      );
      setEnergyScore(null);
      await loadSnapshot();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSavingCheckin(false);
    }
  }

  async function completeTask(task: DashboardTask) {
    if (taskPendingId !== null || task.completedAt) return;
    setTaskPendingId(task.id);
    setTaskError('');
    try {
      await api.post<{ task: DashboardTask }>(`/api/tasks/${task.id}/complete`, {
        completed: true,
      });
      await loadSnapshot();
    } catch (completeError) {
      setTaskError(getErrorMessage(completeError));
    } finally {
      setTaskPendingId(null);
    }
  }

  if (loading && !snapshot) {
    return (
      <Screen>
        <View style={styles.heading}>
          <Skeleton style={styles.eyebrowSkeleton} />
          <Skeleton style={styles.titleSkeleton} />
          <Skeleton style={styles.copySkeleton} />
        </View>
        <Skeleton style={styles.summarySkeleton} />
        <Skeleton style={styles.cardSkeleton} />
        <Skeleton style={styles.cardSkeleton} />
      </Screen>
    );
  }

  if (!snapshot) {
    return (
      <Screen>
        <ErrorState
          description={error || 'Não foi possível carregar seu painel.'}
          onRetry={() => {
            setLoading(true);
            void loadSnapshot();
          }}
          title="Seu painel não carregou"
        />
      </Screen>
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          colors={[theme.accent]}
          onRefresh={refresh}
          refreshing={refreshing}
          tintColor={theme.accent}
        />
      }>
      <View style={styles.heading}>
        <Text color={theme.accent} variant="eyebrow">
          ENERGYOS · HOJE
        </Text>
        <Text variant="title">Seu dia, no seu ritmo.</Text>
        <Text color={theme.textSecondary}>
          Um passo de cada vez. Seu progresso é atualizado pela sua conta.
        </Text>
      </View>

      <View style={styles.stats}>
        <Card style={styles.statCard}>
          <Text color={theme.textSecondary} variant="caption">
            SEQUÊNCIA
          </Text>
          <Text color={theme.orange} variant="heading">
            {snapshot.streak.currentStreak} dias
          </Text>
        </Card>
        <Card style={styles.statCard}>
          <Text color={theme.textSecondary} variant="caption">
            FOCO NA SEMANA
          </Text>
          <Text color={theme.purple} variant="heading">
            {snapshot.weeklyFocusMinutes} min
          </Text>
        </Card>
      </View>

      <Card style={styles.section}>
        <Text variant="sectionTitle">Como está sua energia?</Text>
        <Text color={theme.textSecondary}>
          Registre seu check-in. A data e as recompensas são confirmadas pelo EnergyOS.
        </Text>
        <View accessibilityRole="radiogroup" style={styles.energyOptions}>
          {ENERGY_OPTIONS.map((score) => {
            const selected = energyScore === score;
            return (
              <Pressable
                accessibilityLabel={`Energia ${score} de 5`}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: savingCheckin }}
                disabled={savingCheckin}
                key={score}
                onPress={() => setEnergyScore(score)}
                style={[
                  styles.energyOption,
                  {
                    backgroundColor: selected ? theme.accentBg : theme.surfaceHover,
                    borderColor: selected ? theme.accent : theme.border,
                  },
                ]}>
                <Text color={selected ? theme.accent : theme.text} variant="label">
                  {score}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Button
          disabled={energyScore === null}
          loading={savingCheckin}
          onPress={saveCheckin}
          title="Salvar check-in"
        />
        {checkinMessage ? (
          <Text accessibilityLiveRegion="polite" color={theme.green}>
            {checkinMessage}
          </Text>
        ) : null}
      </Card>

      <Card style={styles.section}>
        <View style={styles.row}>
          <Text variant="sectionTitle">Tarefas de hoje</Text>
          <Text color={theme.textSecondary} variant="caption">
            {snapshot.taskProgress.completed}/{snapshot.taskProgress.total}
          </Text>
        </View>
        {snapshot.tasks.length === 0 ? (
          <Text color={theme.textSecondary}>Você ainda não tem tarefas para hoje.</Text>
        ) : (
          snapshot.tasks.map((task) => {
            const completed = Boolean(task.completedAt);
            const pending = taskPendingId === task.id;
            return (
              <View key={task.id} style={[styles.task, { borderTopColor: theme.border }]}>
                <View style={styles.taskCopy}>
                  <Text color={completed ? theme.textMuted : theme.text} variant="label">
                    {task.title}
                  </Text>
                  {task.startTime ? (
                    <Text color={theme.textMuted} variant="caption">
                      {task.startTime}
                      {task.endTime ? ` – ${task.endTime}` : ''}
                    </Text>
                  ) : null}
                </View>
                {completed ? (
                  <Text color={theme.green} variant="caption">
                    Concluída
                  </Text>
                ) : (
                  <Pressable
                    accessibilityLabel={`Concluir tarefa: ${task.title}`}
                    accessibilityRole="button"
                    accessibilityState={{ busy: pending, disabled: taskPendingId !== null }}
                    disabled={taskPendingId !== null}
                    onPress={() => void completeTask(task)}
                    style={[styles.complete, { borderColor: theme.accent }]}>
                    {pending ? (
                      <ActivityIndicator color={theme.accent} size="small" />
                    ) : (
                      <Text color={theme.accent} variant="caption">
                        Concluir
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            );
          })
        )}
        {taskError ? (
          <Text accessibilityLiveRegion="polite" color={theme.red}>
            {taskError}
          </Text>
        ) : null}
      </Card>

      {error ? (
        <Card style={styles.errorCard}>
          <Text accessibilityLiveRegion="polite" color={theme.red}>
            {error}
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 10, paddingTop: 8 },
  stats: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, gap: 8, padding: 14 },
  section: { gap: 14 },
  energyOptions: { flexDirection: 'row', gap: 10 },
  energyOption: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  task: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 10, paddingTop: 12 },
  taskCopy: { flex: 1, gap: 4 },
  complete: { alignItems: 'center', borderRadius: 10, borderWidth: 1, justifyContent: 'center', minHeight: 44, minWidth: 80, paddingHorizontal: 10 },
  errorCard: { borderColor: '#f87171' },
  eyebrowSkeleton: { height: 12, width: 130 },
  titleSkeleton: { height: 35, width: '85%' },
  copySkeleton: { height: 20, width: '94%' },
  summarySkeleton: { height: 94 },
  cardSkeleton: { height: 208 },
});
