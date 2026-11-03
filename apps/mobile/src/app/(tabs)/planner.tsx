import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { ApiError, api } from '@/shared/api';
import { Button, Card, EmptyState, ErrorState, Screen, Text } from '@/shared/components';
import { getProductDate, getWeekStart } from '@/shared/date';
import { useTheme } from '@/hooks/use-theme';

type Plan = {
  id: number;
  title: string;
  planDate?: string;
  startTime?: string;
  endTime?: string;
  completedAt?: string;
  allDay?: boolean;
};

function message(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível concluir esta ação.';
}

export default function PlannerScreen() {
  const theme = useTheme();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [title, setTitle] = useState('');
  const [planDate, setPlanDate] = useState(getProductDate());
  const [startTime, setStartTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const loadPlans = useCallback(async () => {
    try {
      const weekStart = getWeekStart(getProductDate());
      const result = await api.get<Plan[]>(`/api/weekly-plans?weekStart=${weekStart}`);
      setPlans(result);
      setError('');
    } catch (loadError) {
      setError(message(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  async function createPlan() {
    const cleanTitle = title.trim();
    if (!cleanTitle || saving) return;
    setSaving(true);
    setError('');
    try {
      await api.post<{ plan: Plan }>('/api/weekly-plans', {
        title: cleanTitle,
        planDate,
        ...(startTime.trim() ? { startTime: startTime.trim() } : {}),
      });
      setTitle('');
      setStartTime('');
      await loadPlans();
    } catch (saveError) {
      setError(message(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function togglePlan(plan: Plan) {
    if (pendingId !== null) return;
    setPendingId(plan.id);
    setError('');
    try {
      await api.patch(`/api/weekly-plans/${plan.id}`, { completed: !plan.completedAt });
      await loadPlans();
    } catch (updateError) {
      setError(message(updateError));
    } finally {
      setPendingId(null);
    }
  }

  async function deletePlan(planId: number) {
    if (pendingId !== null) return;
    setPendingId(planId);
    setError('');
    try {
      await api.delete(`/api/weekly-plans/${planId}`);
      setPlans((current) => current.filter((plan) => plan.id !== planId));
    } catch (deleteError) {
      setError(message(deleteError));
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
            void loadPlans();
          }}
          refreshing={refreshing}
          tintColor={theme.accent}
        />
      }>
      <View style={styles.heading}>
        <Text color={theme.accent} variant="eyebrow">SUA ROTINA</Text>
        <Text variant="title">Planejar</Text>
        <Text color={theme.textSecondary}>Organize a semana com passos que cabem no seu dia.</Text>
      </View>

      <Card style={styles.form}>
        <Text variant="sectionTitle">Adicionar ao plano</Text>
        <TextInput
          accessibilityLabel="Título do plano"
          maxLength={120}
          onChangeText={setTitle}
          onSubmitEditing={() => void createPlan()}
          placeholder="O que você quer fazer?"
          placeholderTextColor={theme.textMuted}
          returnKeyType="done"
          style={[styles.input, { backgroundColor: theme.surfaceHover, borderColor: theme.border, color: theme.text }]}
          value={title}
        />
        <View style={styles.row}>
          <TextInput
            accessibilityLabel="Data do plano no formato ano-mês-dia"
            onChangeText={setPlanDate}
            placeholder="AAAA-MM-DD"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, styles.half, { backgroundColor: theme.surfaceHover, borderColor: theme.border, color: theme.text }]}
            value={planDate}
          />
          <TextInput
            accessibilityLabel="Horário de início"
            onChangeText={setStartTime}
            placeholder="HH:MM"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, styles.half, { backgroundColor: theme.surfaceHover, borderColor: theme.border, color: theme.text }]}
            value={startTime}
          />
        </View>
        <Button disabled={!title.trim()} loading={saving} onPress={createPlan} title="Adicionar plano" />
      </Card>

      <View style={styles.sectionHeading}>
        <Text variant="sectionTitle">Esta semana</Text>
        {loading ? <ActivityIndicator color={theme.accent} /> : null}
      </View>
      {error ? <ErrorState description={error} onRetry={() => void loadPlans()} title="Seu plano não carregou" /> : null}
      {!loading && !error && plans.length === 0 ? (
        <EmptyState description="Adicione seu primeiro compromisso para organizar a semana." title="Semana livre por enquanto" />
      ) : null}
      {plans.map((plan) => (
        <Card key={plan.id} style={styles.plan}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: Boolean(plan.completedAt), busy: pendingId === plan.id }}
            disabled={pendingId !== null}
            onPress={() => void togglePlan(plan)}>
            <Text color={plan.completedAt ? theme.textMuted : theme.text} variant="label">
              {plan.completedAt ? '✓  ' : '○  '}{plan.title}
            </Text>
            <Text color={theme.textSecondary} variant="caption">
              {[plan.planDate, plan.startTime, plan.endTime].filter(Boolean).join(' · ') || 'Sem horário'}
            </Text>
          </Pressable>
          <Button
            accessibilityLabel={`Remover ${plan.title}`}
            disabled={pendingId !== null}
            onPress={() => void deletePlan(plan.id)}
            title="Remover"
            variant="quiet"
          />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 10, paddingTop: 8 },
  form: { gap: 12 },
  input: { borderRadius: 12, borderWidth: 1, minHeight: 48, paddingHorizontal: 14 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  plan: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
});
