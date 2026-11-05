import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';

import { ApiError, api } from '@/shared/api';
import { Button, Card, EmptyState, ErrorState, Screen, Text } from '@/shared/components';
import { BottomSheet } from '@/components/ui';
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
  note?: string | null;
};

type PickerTarget = 'date' | 'start' | 'end';

function message(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível concluir esta ação.';
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function formatTimeValue(date: Date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatDateValue(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function pickerDate(planDate: string, time: string) {
  const [year, month, day] = planDate.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0);
}

export default function PlannerScreen() {
  const theme = useTheme();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [planDate, setPlanDate] = useState(getProductDate());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [activePicker, setActivePicker] = useState<PickerTarget | null>(null);
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
    const timer = setTimeout(() => void loadPlans(), 0);
    return () => clearTimeout(timer);
  }, [loadPlans]);

  function openSheet() {
    setPlanDate(getProductDate());
    setActivePicker(null);
    setSheetVisible(true);
  }

  function closeSheet() {
    setSheetVisible(false);
    setActivePicker(null);
  }

  function pickerValue(): Date {
    if (activePicker === 'date') return pickerDate(planDate, '12:00');
    if (activePicker === 'start') return pickerDate(planDate, startTime || '09:00');
    return pickerDate(planDate, endTime || startTime || '10:00');
  }

  function applyPickerValue(date: Date) {
    if (activePicker === 'date') {
      setPlanDate(`${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`);
      if (Platform.OS === 'android') setActivePicker(null);
      return;
    }
    const value = formatTimeValue(date);
    if (activePicker === 'start') setStartTime(value);
    if (activePicker === 'end') setEndTime(value);
    if (Platform.OS === 'android') setActivePicker(null);
  }

  async function createPlan() {
    const cleanTitle = title.trim();
    if (!cleanTitle || saving) return;
    setSaving(true);
    setError('');
    try {
      await api.post<{ plan: Plan }>('/api/weekly-plans', {
        title: cleanTitle,
        planDate,
        note: note.trim() || null,
        ...(startTime ? { startTime } : {}),
        ...(endTime ? { endTime } : {}),
      });
      setTitle('');
      setNote('');
      setStartTime('');
      setEndTime('');
      closeSheet();
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

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.surfaceHover, borderColor: theme.border, color: theme.text },
  ];
  const pickerRowStyle = [
    styles.pickerRow,
    { backgroundColor: theme.surfaceHover, borderColor: theme.border },
  ];

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

      <Pressable
        accessibilityLabel="Adicionar um novo plano"
        accessibilityRole="button"
        onPress={openSheet}
        style={({ pressed }) => [
          styles.form,
          { backgroundColor: theme.surface, borderColor: theme.border },
          pressed && styles.pressed,
        ]}>
        <Text variant="sectionTitle">Adicionar ao plano</Text>
        <Text color={theme.textSecondary} variant="caption">
          Toque para definir título, descrição, data e horário.
        </Text>
      </Pressable>

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
            {plan.note ? (
              <Text color={theme.textSecondary} variant="caption" numberOfLines={2}>
                {plan.note}
              </Text>
            ) : null}
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

      <BottomSheet onClose={closeSheet} title="Novo plano" visible={sheetVisible}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.sheetBody}>
              <TextInput
                accessibilityLabel="Título do plano"
                maxLength={120}
                onChangeText={setTitle}
                placeholder="O que você quer fazer?"
                placeholderTextColor={theme.textMuted}
                returnKeyType="next"
                style={inputStyle}
                value={title}
              />
              <TextInput
                accessibilityLabel="Descrição do plano"
                maxLength={1000}
                multiline
                onChangeText={setNote}
                placeholder="Descrição (opcional)"
                placeholderTextColor={theme.textMuted}
                style={[inputStyle, styles.noteInput]}
                value={note}
              />

              <View style={styles.pickerRows}>
                <Pressable
                  accessibilityLabel="Escolher data do plano"
                  accessibilityRole="button"
                  onPress={() => setActivePicker(activePicker === 'date' ? null : 'date')}
                  style={({ pressed }) => [pickerRowStyle, pressed && styles.pressed]}>
                  <Text color={theme.textSecondary} variant="caption">Data</Text>
                  <Text color={theme.text} variant="label">{formatDateValue(planDate)}</Text>
                </Pressable>
                <View style={styles.timeRow}>
                  <Pressable
                    accessibilityLabel="Escolher horário de início"
                    accessibilityRole="button"
                    onPress={() => setActivePicker(activePicker === 'start' ? null : 'start')}
                    style={({ pressed }) => [pickerRowStyle, pressed && styles.pressed]}>
                    <Text color={theme.textSecondary} variant="caption">Início</Text>
                    <Text color={startTime ? theme.text : theme.textMuted} variant="label">
                      {startTime || 'Definir'}
                    </Text>
                  </Pressable>
                  {startTime ? (
                    <Pressable
                      accessibilityLabel="Remover horário de início"
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => setStartTime('')}>
                      <Text color={theme.textMuted} variant="label">×</Text>
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.timeRow}>
                  <Pressable
                    accessibilityLabel="Escolher horário de fim"
                    accessibilityRole="button"
                    onPress={() => setActivePicker(activePicker === 'end' ? null : 'end')}
                    style={({ pressed }) => [pickerRowStyle, pressed && styles.pressed]}>
                    <Text color={theme.textSecondary} variant="caption">Fim</Text>
                    <Text color={endTime ? theme.text : theme.textMuted} variant="label">
                      {endTime || 'Definir'}
                    </Text>
                  </Pressable>
                  {endTime ? (
                    <Pressable
                      accessibilityLabel="Remover horário de fim"
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => setEndTime('')}>
                      <Text color={theme.textMuted} variant="label">×</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {activePicker ? (
                <View style={styles.clockWrap}>
                  <DateTimePicker
                    accentColor={theme.accent}
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    is24Hour
                    mode={activePicker === 'date' ? 'date' : 'time'}
                    onDismiss={() => setActivePicker(null)}
                    onValueChange={(_event, date) => applyPickerValue(date)}
                    presentation={Platform.OS === 'ios' ? 'inline' : 'dialog'}
                    themeVariant="dark"
                    value={pickerValue()}
                  />
                </View>
              ) : null}

              <Button
                disabled={!title.trim()}
                loading={saving}
                onPress={() => void createPlan()}
                title="Adicionar plano"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 10, paddingTop: 8 },
  form: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  pressed: { opacity: 0.7 },
  input: { borderRadius: 12, borderWidth: 1, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10 },
  noteInput: { minHeight: 72, textAlignVertical: 'top' },
  pickerRows: { gap: 8 },
  pickerRow: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  timeRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  clockWrap: { alignItems: 'center', minHeight: 40 },
  sheetBody: { gap: 12, paddingBottom: 8 },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  plan: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
});
