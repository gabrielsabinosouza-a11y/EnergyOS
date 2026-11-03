import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { ApiError, api } from '@/shared/api';
import { Button, Card, EmptyState, ErrorState, Screen, StatCard, Text } from '@/shared/components';
import type {
  DailyHabit,
  DailyHabitProgressResponse,
  DailyHabitsResponse,
} from '@/features/dashboard/types';
import { HabitItem } from '@/features/dashboard/habit-item';
import { FocusTimer } from '@/features/focus/focus-timer';

type FocusSession = {
  id: number;
  startedAt: string;
  durationMinutes: number;
  targetDurationMinutes: number;
  xpEarned: number;
};

type FocusState = {
  history: FocusSession[];
  todayStats: { minutesFocused: number; coinsEarned: number };
  lifetimeFocusMinutes: number;
  xp: { level: number; totalXP: number };
};

type FocusRoom = {
  id: number;
  name?: string;
  code?: string;
  status?: string;
  durationMinutes?: number;
  participants?: { displayName?: string }[];
};

type ActiveFocusSession = Pick<FocusSession, 'id' | 'startedAt' | 'targetDurationMinutes'>;
type TimerStatus = 'idle' | 'running' | 'paused';
type StoredTimer = {
  version: 1;
  session: ActiveFocusSession;
  elapsedSeconds: number;
  runningSinceMs: number | null;
  pausedCount: number;
  status: Exclude<TimerStatus, 'idle'>;
};

const TIMER_STORAGE_KEY = 'energyos_mobile_focus_session';
const DEFAULT_DURATION_MINUTES = 60;
const MIN_DURATION_MINUTES = 10;
const MAX_DURATION_MINUTES = 120;
const focusIcon = require('../../../assets/energyos/stats/focus.png');

function errorText(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível concluir esta ação.';
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0) return rest > 0 ? `${hours}h ${rest}min` : `${hours}h`;
  return `${minutes} min`;
}

function isStoredTimer(value: unknown): value is StoredTimer {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<StoredTimer>;
  return (
    candidate.version === 1 &&
    typeof candidate.session === 'object' &&
    candidate.session !== null &&
    Number.isInteger(candidate.session.id) &&
    typeof candidate.session.startedAt === 'string' &&
    Number.isInteger(candidate.session.targetDurationMinutes) &&
    Number.isInteger(candidate.elapsedSeconds) &&
    (candidate.runningSinceMs === null || typeof candidate.runningSinceMs === 'number') &&
    Number.isInteger(candidate.pausedCount) &&
    (candidate.status === 'running' || candidate.status === 'paused')
  );
}

export default function FocusScreen() {
  const theme = useTheme();
  const [focus, setFocus] = useState<FocusState | null>(null);
  const [rooms, setRooms] = useState<FocusRoom[]>([]);
  const [habits, setHabits] = useState<DailyHabit[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveFocusSession | null>(null);
  const [timerStatus, setTimerStatus] = useState<TimerStatus>('idle');
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_DURATION_MINUTES);
  const [elapsedBeforeRun, setElapsedBeforeRun] = useState(0);
  const [runningSinceMs, setRunningSinceMs] = useState<number | null>(null);
  const [pausedCount, setPausedCount] = useState(0);
  const [clockNow, setClockNow] = useState(Date.now);
  const [joinCode, setJoinCode] = useState('');
  const [roomMinutes, setRoomMinutes] = useState('25');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [focusSaving, setFocusSaving] = useState(false);
  const [habitPendingId, setHabitPendingId] = useState<number | null>(null);
  const [habitError, setHabitError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [habitsLoading, setHabitsLoading] = useState(true);
  const restoredRef = useRef(false);
  const finishPendingRef = useRef(false);
  const finishFocusRef = useRef<((focusedSeconds?: number) => Promise<void>) | null>(null);

  const elapsedSeconds = Math.min(
    (activeSession?.targetDurationMinutes ?? durationMinutes) * 60,
    elapsedBeforeRun +
      (timerStatus === 'running' && runningSinceMs !== null
        ? Math.max(0, Math.floor((clockNow - runningSinceMs) / 1000))
        : 0),
  );
  const totalSessionSeconds = (activeSession?.targetDurationMinutes ?? durationMinutes) * 60;
  const remainingSeconds = Math.max(0, totalSessionSeconds - elapsedSeconds);
  const elapsedProgress = totalSessionSeconds > 0 ? elapsedSeconds / totalSessionSeconds : 0;

  const load = useCallback(async () => {
    try {
      const [focusState, roomState] = await Promise.all([
        api.get<FocusState>('/api/focus'),
        api.get<{ rooms: FocusRoom[] }>('/api/focus-rooms'),
      ]);
      setFocus(focusState);
      setRooms(roomState.rooms);
      setError('');
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }

    try {
      const result = await api.get<DailyHabitsResponse>('/api/daily-tasks');
      setHabits(result.tasks);
      setHabitError('');
    } catch (loadError) {
      setHabitError(errorText(loadError));
    } finally {
      setHabitsLoading(false);
    }
  }, []);

  useEffect(() => {
    const request = setTimeout(() => void load(), 0);
    return () => clearTimeout(request);
  }, [load]);

  useEffect(() => {
    let active = true;
    const restoreTimer = async () => {
      try {
        const stored = await AsyncStorage.getItem(TIMER_STORAGE_KEY);
        if (!active) return;
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (isStoredTimer(parsed)) {
            const duration = parsed.session.targetDurationMinutes;
            if (duration >= MIN_DURATION_MINUTES && duration <= MAX_DURATION_MINUTES) {
              setActiveSession(parsed.session);
              setDurationMinutes(duration);
              setElapsedBeforeRun(Math.max(0, parsed.elapsedSeconds));
              setRunningSinceMs(parsed.status === 'running' ? parsed.runningSinceMs ?? Date.now() : null);
              setPausedCount(Math.max(0, parsed.pausedCount));
              setTimerStatus(parsed.status);
              setClockNow(Date.now());
            } else {
              await AsyncStorage.removeItem(TIMER_STORAGE_KEY);
            }
          } else {
            await AsyncStorage.removeItem(TIMER_STORAGE_KEY);
          }
        }
      } catch (restoreError) {
        console.warn('[focus] Não foi possível restaurar a sessão local:', restoreError);
        try {
          await AsyncStorage.removeItem(TIMER_STORAGE_KEY);
        } catch (removeError) {
          console.warn('[focus] Não foi possível limpar a sessão local inválida:', removeError);
        }
      } finally {
        if (active) restoredRef.current = true;
      }
    };

    void restoreTimer();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!restoredRef.current) return;
    if (!activeSession || timerStatus === 'idle') {
      void AsyncStorage.removeItem(TIMER_STORAGE_KEY).catch((storageError: unknown) => {
        console.warn('[focus] Não foi possível limpar a sessão local:', storageError);
      });
      return;
    }

    const stored: StoredTimer = {
      version: 1,
      session: activeSession,
      elapsedSeconds: elapsedBeforeRun,
      runningSinceMs,
      pausedCount,
      status: timerStatus,
    };
    void AsyncStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(stored)).catch((storageError: unknown) => {
      console.warn('[focus] Não foi possível salvar a sessão local:', storageError);
    });
  }, [activeSession, elapsedBeforeRun, pausedCount, runningSinceMs, timerStatus]);

  const finishFocus = useCallback(async (finalElapsedSeconds?: number) => {
    if (!activeSession || finishPendingRef.current) return;
    finishPendingRef.current = true;
    setFocusSaving(true);
    setError('');
    const focusedSeconds = Math.min(
      totalSessionSeconds,
      Math.max(0, finalElapsedSeconds ?? elapsedSeconds),
    );
    try {
      const result = await api.post<{ xpAwarded: number; coinsAwarded: number }>('/api/focus', {
        action: 'end',
        sessionId: activeSession.id,
        focusedSeconds,
        pausedCount,
      });
      setNotice(`Sessão registrada · +${result.xpAwarded} XP · +${result.coinsAwarded} moedas`);
      setActiveSession(null);
      setTimerStatus('idle');
      setElapsedBeforeRun(0);
      setRunningSinceMs(null);
      setPausedCount(0);
      await load();
    } catch (finishError) {
      setError(errorText(finishError));
      setElapsedBeforeRun(focusedSeconds);
      setRunningSinceMs(null);
      setTimerStatus('paused');
    } finally {
      finishPendingRef.current = false;
      setFocusSaving(false);
    }
  }, [activeSession, elapsedSeconds, load, pausedCount, totalSessionSeconds]);

  useEffect(() => {
    finishFocusRef.current = finishFocus;
  }, [finishFocus]);

  useEffect(() => {
    if (!activeSession || timerStatus !== 'running') return;
    const interval = setInterval(() => {
      const now = Date.now();
      setClockNow(now);
      if (
        runningSinceMs !== null &&
        elapsedBeforeRun + Math.floor((now - runningSinceMs) / 1000) >= totalSessionSeconds
      ) {
        void finishFocusRef.current?.(
          elapsedBeforeRun + Math.floor((now - runningSinceMs) / 1000),
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSession, elapsedBeforeRun, runningSinceMs, timerStatus, totalSessionSeconds]);

  async function startFocus() {
    setFocusSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await api.post<{ session: FocusSession }>('/api/focus', {
        action: 'start',
        targetDurationMinutes: durationMinutes,
        energyType: 'flame',
      });
      const target = result.session.targetDurationMinutes;
      setActiveSession({
        id: result.session.id,
        startedAt: result.session.startedAt,
        targetDurationMinutes: target,
      });
      setDurationMinutes(target);
      setElapsedBeforeRun(0);
      setPausedCount(0);
      setClockNow(Date.now());
      setRunningSinceMs(Date.now());
      setTimerStatus('running');
    } catch (startError) {
      setError(errorText(startError));
    } finally {
      setFocusSaving(false);
    }
  }

  function togglePause() {
    if (timerStatus === 'running') {
      setElapsedBeforeRun(elapsedSeconds);
      setRunningSinceMs(null);
      setPausedCount((count) => count + 1);
      setTimerStatus('paused');
    } else if (timerStatus === 'paused') {
      setClockNow(Date.now());
      setRunningSinceMs(Date.now());
      setTimerStatus('running');
    }
  }

  async function updateHabit(habit: DailyHabit, completedCount: number) {
    if (habitPendingId !== null || completedCount < 0 || completedCount > habit.dailyTarget) return;
    setHabitPendingId(habit.id);
    setHabitError('');
    setNotice('');
    try {
      const result = await api.patch<DailyHabitProgressResponse>(
        `/api/daily-tasks/${habit.id}`,
        { completedCount },
      );
      setHabits((current) => current.map((item) => (item.id === habit.id ? result.task : item)));
      const rewards = [
        result.xpAwarded > 0 ? `+${result.xpAwarded} XP` : '',
        result.coinsAwarded > 0 ? `+${result.coinsAwarded} moedas` : '',
      ].filter(Boolean);
      setNotice(rewards.length ? `Hábito atualizado · ${rewards.join(' · ')}` : 'Hábito atualizado.');
    } catch (updateError) {
      setHabitError(errorText(updateError));
    } finally {
      setHabitPendingId(null);
    }
  }

  async function createRoom() {
    const duration = Number(roomMinutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 180) {
      setError('Escolha uma duração de sala entre 1 e 180 minutos.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/api/focus-rooms', { durationMinutes: duration });
      await load();
    } catch (createError) {
      setError(errorText(createError));
    } finally {
      setSaving(false);
    }
  }

  async function joinRoom() {
    const code = joinCode.trim();
    if (!code) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await api.post<{ message?: string }>(
        `/api/focus-rooms/${encodeURIComponent(code)}/join`,
        {},
      );
      setNotice(result.message || 'Solicitação enviada.');
      setJoinCode('');
      await load();
    } catch (joinError) {
      setError(errorText(joinError));
    } finally {
      setSaving(false);
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
        <Text color={theme.purple} variant="eyebrow">PRESENÇA</Text>
        <Text variant="title">Foco</Text>
        <Text color={theme.textSecondary}>Reserve um tempo para avançar com intenção.</Text>
      </View>

      {error ? (
        <ErrorState
          description={error}
          onRetry={() => {
            if (activeSession && timerStatus === 'paused') void finishFocus();
            else void load();
          }}
          title="Não foi possível atualizar o foco"
        />
      ) : null}
      {notice ? <Text accessibilityLiveRegion="polite" color={theme.green}>{notice}</Text> : null}

      <Card style={styles.focusCard}>
        <View style={styles.cardHeading}>
          <Text color={theme.purple} variant="eyebrow">◷  FOCO</Text>
          <Text color={theme.textMuted} variant="caption">
            {timerStatus === 'idle' ? 'RITMO NO SEU TEMPO' : timerStatus === 'paused' ? 'PAUSADO' : 'EM ANDAMENTO'}
          </Text>
        </View>

        <FocusTimer
          active={timerStatus !== 'idle'}
          durationMinutes={durationMinutes}
          elapsedProgress={elapsedProgress}
          onDurationChange={setDurationMinutes}
          paused={timerStatus === 'paused'}
          remainingSeconds={remainingSeconds}
        />

        {timerStatus === 'idle' ? (
          <Button loading={focusSaving} onPress={startFocus} title="▶  Iniciar foco" />
        ) : (
          <View style={styles.actions}>
            <Button
              disabled={focusSaving}
              loading={focusSaving}
              onPress={togglePause}
              title={timerStatus === 'paused' ? 'Continuar' : 'Pausar'}
              variant="secondary"
            />
            <Button
              disabled={focusSaving}
              onPress={() => void finishFocus()}
              title={remainingSeconds === 0 ? 'Salvar sessão' : 'Encerrar sessão'}
              variant="secondary"
            />
          </View>
        )}
        {timerStatus === 'idle' ? (
          <Text color={theme.textMuted} style={styles.rewardHint} variant="caption">
            Suas recompensas são calculadas pelo EnergyOS ao concluir.
          </Text>
        ) : null}
      </Card>

      <View style={styles.stats}>
        <StatCard
          color={theme.purple}
          icon={focusIcon}
          label="FOCO HOJE"
          value={formatDuration(focus?.todayStats.minutesFocused ?? 0)}
        />
        <StatCard
          color={theme.orange}
          label="MOEDAS HOJE"
          value={`◉ ${focus?.todayStats.coinsEarned ?? 0}`}
        />
      </View>

      <Card style={styles.section}>
        <Text color={theme.textMuted} variant="eyebrow">SESSÕES RECENTES</Text>
        {loading && !focus ? (
          <Text color={theme.textSecondary}>Carregando seu histórico…</Text>
        ) : focus?.history.length ? (
          focus.history.slice(0, 5).map((session) => (
            <View key={session.id} style={[styles.sessionRow, { borderTopColor: theme.border }]}>
              <View style={styles.sessionCopy}>
                <Text color={theme.text} variant="label">{formatDuration(session.durationMinutes)}</Text>
                <Text color={theme.textMuted} variant="caption">
                  {new Date(session.startedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </Text>
              </View>
              <Text color={theme.orange} style={styles.sessionReward} variant="caption">
                +{session.xpEarned} XP
              </Text>
            </View>
          ))
        ) : (
          <EmptyState description="Suas sessões concluídas aparecerão aqui." title="Nenhuma sessão recente" />
        )}
      </Card>

      <Card style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text variant="sectionTitle">Hábitos de hoje</Text>
          <Text color={theme.textSecondary} variant="caption">{habits.length} hábitos</Text>
        </View>
        {habitsLoading ? (
          <Text color={theme.textSecondary}>Carregando seus hábitos…</Text>
        ) : habits.length ? (
          habits.map((habit) => (
            <HabitItem
              busy={habitPendingId === habit.id}
              disabled={habitPendingId !== null}
              habit={habit}
              key={habit.id}
              onDecrement={() => void updateHabit(habit, habit.completedCount - 1)}
              onIncrement={() => void updateHabit(habit, habit.completedCount + 1)}
            />
          ))
        ) : (
          <Text color={theme.textSecondary}>Nenhum hábito está programado para hoje.</Text>
        )}
        {habitError ? <Text accessibilityLiveRegion="polite" color={theme.red}>{habitError}</Text> : null}
      </Card>

      <Card style={styles.section}>
        <Text variant="sectionTitle">Salas de foco</Text>
        <Text color={theme.textSecondary}>Crie uma sala para convidar pessoas ou entre com um código.</Text>
        <View style={styles.formRow}>
          <TextInput
            accessibilityLabel="Duração da sala em minutos"
            keyboardType="number-pad"
            maxLength={3}
            onChangeText={setRoomMinutes}
            placeholder="Minutos"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              styles.roomDuration,
              { backgroundColor: theme.surfaceHover, borderColor: theme.border, color: theme.text },
            ]}
            value={roomMinutes}
          />
          <Button loading={saving} onPress={createRoom} title="Criar sala" variant="secondary" />
        </View>
        <View style={styles.formRow}>
          <TextInput
            accessibilityLabel="Código da sala"
            autoCapitalize="characters"
            maxLength={24}
            onChangeText={setJoinCode}
            placeholder="Código da sala"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              { backgroundColor: theme.surfaceHover, borderColor: theme.border, color: theme.text },
            ]}
            value={joinCode}
          />
          <Button
            disabled={!joinCode.trim()}
            loading={saving}
            onPress={joinRoom}
            title="Entrar"
          />
        </View>
      </Card>

      {!loading && rooms.length === 0 ? (
        <EmptyState description="Crie uma sala ou entre usando um convite." title="Nenhuma sala recente" />
      ) : null}
      {rooms.map((room) => (
        <Card key={room.id} style={styles.room}>
          <View style={styles.roomCopy}>
            <Text variant="label">{room.name || `Sala ${room.code || room.id}`}</Text>
            <Text color={theme.textSecondary} variant="caption">
              {room.status || 'Sala de foco'} · {room.participants?.length ?? 0} participantes
            </Text>
          </View>
          {room.code ? <Text color={theme.accent} variant="label">{room.code}</Text> : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 10, paddingTop: 8 },
  focusCard: { gap: 12, overflow: 'hidden', padding: 18 },
  cardHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  rewardHint: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10 },
  stats: { flexDirection: 'row', gap: 12 },
  section: { gap: 14 },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sessionRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  sessionCopy: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  sessionReward: { fontVariant: ['tabular-nums'] },
  formRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 14,
    textAlign: 'center',
  },
  roomDuration: { flex: 0.6 },
  room: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  roomCopy: { flex: 1, gap: 4 },
});
