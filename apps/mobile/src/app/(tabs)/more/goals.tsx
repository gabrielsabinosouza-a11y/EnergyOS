import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { ApiError, api } from '@/shared/api';
import { Button, Card, EmptyState, ErrorState, Screen, Text } from '@/shared/components';
import { useTheme } from '@/hooks/use-theme';

type Goal = {
  id: number;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string | null;
  deadline: string | null;
  completedAt: string | null;
};

type GoalBundle = { goal: Goal; habits: { id: number; title: string; frequency: string }[] };

function errorText(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível concluir esta ação.';
}

export default function GoalsScreen() {
  const theme = useTheme();
  const [bundles, setBundles] = useState<GoalBundle[]>([]);
  const [title, setTitle] = useState('');
  const [targetValue, setTargetValue] = useState('1');
  const [unit, setUnit] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setBundles(await api.get<GoalBundle[]>('/api/goals'));
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

  async function createGoal() {
    const cleanTitle = title.trim();
    const target = Number(targetValue);
    if (!cleanTitle || !Number.isFinite(target) || target < 1 || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/api/goals', {
        title: cleanTitle,
        targetValue: target,
        ...(unit.trim() ? { unit: unit.trim() } : {}),
      });
      setTitle('');
      setUnit('');
      setTargetValue('1');
      setNotice('Meta criada.');
      await load();
    } catch (createError) {
      setError(errorText(createError));
    } finally {
      setBusy(false);
    }
  }

  async function logProgress(goalId: number) {
    if (pendingId !== null) return;
    setPendingId(goalId);
    setError('');
    setNotice('');
    try {
      const result = await api.post<{ xpAwarded: number; coinsAwarded: number }>('/api/goal-logs', {
        goalId,
        action: 'increment',
        amount: 1,
      });
      setNotice(`Progresso registrado · +${result.xpAwarded} XP · +${result.coinsAwarded} moedas`);
      await load();
    } catch (logError) {
      setError(errorText(logError));
    } finally {
      setPendingId(null);
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
        <Text color={theme.accent} variant="eyebrow">INTENÇÃO EM MOVIMENTO</Text>
        <Text variant="title">Metas</Text>
        <Text color={theme.textSecondary}>Acompanhe objetivos e registre cada avanço.</Text>
      </View>
      {error ? <ErrorState description={error} onRetry={() => void load()} title="Metas indisponíveis" /> : null}
      {notice ? <Text accessibilityLiveRegion="polite" color={theme.green}>{notice}</Text> : null}
      <Card style={styles.form}>
        <Text variant="sectionTitle">Nova meta</Text>
        <TextInput accessibilityLabel="Título da meta" maxLength={120} onChangeText={setTitle} placeholder="Ex.: Ler mais" placeholderTextColor={theme.textMuted} style={[styles.input, { backgroundColor: theme.surfaceHover, borderColor: theme.border, color: theme.text }]} value={title} />
        <View style={styles.row}>
          <TextInput accessibilityLabel="Quantidade alvo" keyboardType="decimal-pad" onChangeText={setTargetValue} placeholder="Alvo" placeholderTextColor={theme.textMuted} style={[styles.input, styles.small, { backgroundColor: theme.surfaceHover, borderColor: theme.border, color: theme.text }]} value={targetValue} />
          <TextInput accessibilityLabel="Unidade da meta" maxLength={32} onChangeText={setUnit} placeholder="Unidade (opcional)" placeholderTextColor={theme.textMuted} style={[styles.input, { backgroundColor: theme.surfaceHover, borderColor: theme.border, color: theme.text }]} value={unit} />
        </View>
        <Button disabled={!title.trim()} loading={busy} onPress={createGoal} title="Criar meta" />
      </Card>
      {!loading && bundles.length === 0 ? <EmptyState description="Escolha algo importante e acompanhe seu progresso." title="Comece com uma meta" /> : null}
      {bundles.map(({ goal, habits }) => (
        <Card key={goal.id} style={styles.goal}>
          <Text variant="label">{goal.title}{goal.completedAt ? ' · concluída' : ''}</Text>
          <Text color={theme.accent} variant="heading">
            {goal.currentValue} / {goal.targetValue}{goal.unit ? ` ${goal.unit}` : ''}
          </Text>
          {goal.deadline ? <Text color={theme.textSecondary}>Prazo: {goal.deadline}</Text> : null}
          {habits.length ? <Text color={theme.textSecondary}>Hábitos: {habits.map((habit) => habit.title).join(', ')}</Text> : null}
          {!goal.completedAt ? <Button disabled={pendingId !== null} loading={pendingId === goal.id} onPress={() => void logProgress(goal.id)} title="Registrar avanço +1" variant="secondary" /> : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 10, paddingTop: 8 },
  form: { gap: 12 },
  input: { borderRadius: 12, borderWidth: 1, flex: 1, minHeight: 48, paddingHorizontal: 14 },
  row: { flexDirection: 'row', gap: 10 },
  small: { flex: 0.45 },
  goal: { gap: 10 },
});
