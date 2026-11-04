import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

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
import {
  canCancelFocusSession,
  focusPhaseAt,
  GRACE_PERIOD_SECONDS,
  shouldGiveUpAfterAway,
} from '@/shared/focus-session-state';

type FocusSession = {
  id: number;
  startedAt: string;
  durationMinutes: number;
  targetDurationMinutes: number;
  xpEarned: number;
  endReason?: 'completed' | 'gave_up';
  focusedSeconds?: number;
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
  version: 1 | 2;
  session: ActiveFocusSession;
  elapsedSeconds: number;
  runningSinceMs: number | null;
  awayStartedAtMs: number | null;
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
    (candidate.version === 1 || candidate.version === 2) &&
    typeof candidate.session === 'object' &&
    candidate.session !== null &&
    Number.isInteger(candidate.session.id) &&
    typeof candidate.session.startedAt === 'string' &&
    Number.isInteger(candidate.session.targetDurationMinutes) &&
    Number.isInteger(candidate.elapsedSeconds) &&
    (candidate.runningSinceMs === null || typeof candidate.runningSinceMs === 'number') &&
    (candidate.awayStartedAtMs === null || typeof candidate.awayStartedAtMs === 'number' || candidate.awayStartedAtMs === undefined) &&
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
  const [awayStartedAtMs, setAwayStartedAtMs] = useState<number | null>(null);
  const [energyExtinguished, setEnergyExtinguished] = useState(false);
  const [showGiveUpConfirm, setShowGiveUpConfirm] = useState(false);
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
  const finishFocusRef = useRef<((focusedSeconds?: number, reason?: 'completed' | 'gave_up') => Promise<void>) | null>(null);
  const elapsedSecondsRef = useRef(0);
  const awayStartedAtRef = useRef<number | null>(null);
  const notificationIdRef = useRef<string | null>(null);
  const awayReturnPendingRef = useRef(false);

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
  const gracePeriod = activeSession !== null &&
    focusPhaseAt(new Date(activeSession.startedAt).getTime(), clockNow) === 'grace_period';
  const graceSecondsRemaining = activeSession
    ? Math.max(0, Math.ceil(
        (GRACE_PERIOD_SECONDS * 1000 -
          (clockNow - new Date(activeSession.startedAt).getTime())) / 1000,
      ))
    : 0;

  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
    awayStartedAtRef.current = awayStartedAtMs;
  }, [awayStartedAtMs, elapsedSeconds]);

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
              setAwayStartedAtMs(parsed.awayStartedAtMs ?? null);
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
      version: 2,
      session: activeSession,
      elapsedSeconds: elapsedBeforeRun,
      runningSinceMs,
      awayStartedAtMs,
      pausedCount,
      status: timerStatus,
    };
    void AsyncStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(stored)).catch((storageError: unknown) => {
      console.warn('[focus] Não foi possível salvar a sessão local:', storageError);
    });
  }, [activeSession, awayStartedAtMs, elapsedBeforeRun, pausedCount, runningSinceMs, timerStatus]);

  const finishFocus = useCallback(async (
    finalElapsedSeconds?: number,
    reason: 'completed' | 'gave_up' = 'completed',
  ) => {
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
        action: reason === 'gave_up' ? 'give_up' : 'complete',
        sessionId: activeSession.id,
        focusedSeconds,
        pausedCount,
      });
      if (reason === 'completed') {
        setNotice(`Sessão registrada · +${result.xpAwarded} XP · +${result.coinsAwarded} moedas`);
      } else {
        setNotice('Você consegue mais na próxima.');
        setEnergyExtinguished(true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch((hapticError: unknown) => {
          console.warn('[focus] Não foi possível reproduzir o haptic de desistência:', hapticError);
        });
        setTimeout(() => setEnergyExtinguished(false), 3500);
      }
      setActiveSession(null);
      setTimerStatus('idle');
      setElapsedBeforeRun(0);
      setRunningSinceMs(null);
      setPausedCount(0);
      setAwayStartedAtMs(null);
      setShowGiveUpConfirm(false);
      if (notificationIdRef.current) {
        void Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
        notificationIdRef.current = null;
      }
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

  const continueAfterAway = useCallback(async (awayAt: number, session: ActiveFocusSession) => {
    if (awayReturnPendingRef.current) return;
    awayReturnPendingRef.current = true;
    const awaySeconds = Math.max(0, Math.floor((Date.now() - awayAt) / 1000));
    if (notificationIdRef.current) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
      } catch (notificationError) {
        console.warn('[focus] Não foi possível cancelar a notificação local:', notificationError);
      }
      notificationIdRef.current = null;
    }
    try {
      const result = await api.post<{ gaveUp: boolean }>('/api/focus', {
        action: 'app_state',
        state: 'return',
        sessionId: session.id,
      });
      setAwayStartedAtMs(null);
      if (result.gaveUp || shouldGiveUpAfterAway(awaySeconds)) {
        await finishFocusRef.current?.(elapsedSecondsRef.current, 'gave_up');
      }
    } catch (returnError) {
      setError(errorText(returnError));
      if (shouldGiveUpAfterAway(awaySeconds)) {
        await finishFocusRef.current?.(elapsedSecondsRef.current, 'gave_up');
      }
    } finally {
      awayReturnPendingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' && activeSession && timerStatus === 'running' &&
          focusPhaseAt(new Date(activeSession.startedAt).getTime(), Date.now()) === 'focusing') {
        const awayAt = Date.now();
        awayStartedAtRef.current = awayAt;
        setAwayStartedAtMs(awayAt);
        const saved: StoredTimer = {
          version: 2,
          session: activeSession,
          elapsedSeconds: elapsedSecondsRef.current,
          runningSinceMs,
          awayStartedAtMs: awayAt,
          pausedCount,
          status: 'running',
        };
        void AsyncStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(saved)).catch((storageError: unknown) => {
          console.warn('[focus] Não foi possível salvar o horário de saída do app:', storageError);
        });
        void api.post('/api/focus', {
          action: 'app_state',
          state: 'away',
          sessionId: activeSession.id,
        }).catch((awayError: unknown) => {
          console.warn('[focus] Não foi possível registrar a saída do app no servidor:', awayError);
        });
        void Notifications.scheduleNotificationAsync({
          content: {
            title: 'Seu foco ainda está ativo',
            body: 'Volte ao EnergyOS agora para não apagar sua energia! Você tem menos de 1 minuto.',
            data: { url: '/(tabs)/focus' },
          },
          trigger: null,
        }).then((identifier) => {
          if (AppState.currentState === 'active') {
            return Notifications.cancelScheduledNotificationAsync(identifier);
          }
          notificationIdRef.current = identifier;
          return undefined;
        }).catch((notificationError: unknown) => {
          console.warn('[focus] Não foi possível agendar a notificação de foco:', notificationError);
        });
      } else if (nextState === 'active' && activeSession && timerStatus === 'running') {
        const awayAt = awayStartedAtRef.current;
        if (awayAt !== null) void continueAfterAway(awayAt, activeSession);
      }
    });
    return () => subscription.remove();
  }, [activeSession, continueAfterAway, pausedCount, runningSinceMs, timerStatus]);

  useEffect(() => {
    if (AppState.currentState !== 'active' || !activeSession ||
        timerStatus !== 'running' || awayStartedAtMs === null) return;
    void continueAfterAway(awayStartedAtMs, activeSession);
  }, [activeSession, awayStartedAtMs, continueAfterAway, timerStatus]);

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
      setAwayStartedAtMs(null);
      setClockNow(Date.now());
      setRunningSinceMs(Date.now());
      setTimerStatus('running');
      setEnergyExtinguished(false);
    } catch (startError) {
      setError(errorText(startError));
    } finally {
      setFocusSaving(false);
    }
  }

  async function togglePause() {
    if (timerStatus === 'running') {
      if (!activeSession || gracePeriod) return;
      setFocusSaving(true);
      try {
        await api.post('/api/focus', { action: 'pause', sessionId: activeSession.id });
      } catch (pauseError) {
        setError(errorText(pauseError));
        setFocusSaving(false);
        return;
      }
      setElapsedBeforeRun(elapsedSeconds);
      setRunningSinceMs(null);
      setPausedCount((count) => count + 1);
      setTimerStatus('paused');
    } else if (timerStatus === 'paused') {
      if (!activeSession) return;
      setFocusSaving(true);
      try {
        await api.post('/api/focus', { action: 'resume', sessionId: activeSession.id });
      } catch (resumeError) {
        setError(errorText(resumeError));
        setFocusSaving(false);
        return;
      }
      setClockNow(Date.now());
      setRunningSinceMs(Date.now());
      setTimerStatus('running');
    }
    setFocusSaving(false);
  }

  async function cancelFocus() {
    if (!activeSession || !gracePeriod || !canCancelFocusSession(
      new Date(activeSession.startedAt).getTime(),
      Date.now(),
    )) return;
    setFocusSaving(true);
    setError('');
    try {
      await api.post('/api/focus', { action: 'cancel', sessionId: activeSession.id });
      setActiveSession(null);
      setTimerStatus('idle');
      setElapsedBeforeRun(0);
      setRunningSinceMs(null);
      setPausedCount(0);
      setAwayStartedAtMs(null);
      setNotice('Sessão cancelada');
    } catch (cancelError) {
      setError(errorText(cancelError));
    } finally {
      setFocusSaving(false);
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
      {notice ? (
        <Text
          accessibilityLiveRegion="polite"
          color={notice === 'Sessão cancelada' || notice === 'Você consegue mais na próxima.' ? theme.textSecondary : theme.green}>
          {notice}
        </Text>
      ) : null}

      <Card style={styles.focusCard}>
        <View style={styles.cardHeading}>
          <Text color={theme.purple} variant="eyebrow">◷  FOCO</Text>
          <Text color={theme.textMuted} variant="caption">
            {timerStatus === 'idle'
              ? 'RITMO NO SEU TEMPO'
              : timerStatus === 'paused'
                ? 'PAUSADO'
                : gracePeriod
                  ? 'PERÍODO DE CANCELAMENTO'
                  : 'EM ANDAMENTO'}
          </Text>
        </View>

        <FocusTimer
          active={timerStatus !== 'idle'}
          durationMinutes={durationMinutes}
          elapsedProgress={elapsedProgress}
          onDurationChange={setDurationMinutes}
          paused={timerStatus === 'paused'}
          gracePeriod={gracePeriod}
          graceSecondsRemaining={graceSecondsRemaining}
          extinguished={energyExtinguished}
          remainingSeconds={remainingSeconds}
        />

        {timerStatus === 'idle' ? (
          <Button loading={focusSaving} onPress={startFocus} title="▶  Iniciar foco" />
        ) : (
          <View style={styles.actions}>
            {!gracePeriod ? (
              <Button
                disabled={focusSaving}
                loading={focusSaving}
                onPress={() => void togglePause()}
                title={timerStatus === 'paused' ? 'Continuar' : 'Pausa'}
                variant="secondary"
              />
            ) : null}
            <Animated.View
              key={gracePeriod ? 'focus-cancel' : 'focus-give-up'}
              entering={FadeIn.duration(160)}
              exiting={FadeOut.duration(120)}
              style={styles.actionSlot}>
              <Pressable
                accessibilityLabel={gracePeriod
                  ? `Cancelar sessão sem penalidade, ${graceSecondsRemaining} segundos restantes`
                  : 'Desistir da sessão de foco'}
                accessibilityRole="button"
                accessibilityState={{ disabled: focusSaving, busy: focusSaving }}
                disabled={focusSaving}
                onPress={() => {
                  if (gracePeriod) void cancelFocus();
                  else setShowGiveUpConfirm(true);
                }}
                style={({ pressed }) => [
                  styles.cancelButton,
                  {
                    backgroundColor: gracePeriod ? theme.surfaceHover : '#6e322f',
                    borderColor: gracePeriod ? theme.border : '#b14d46',
                  },
                  pressed && styles.buttonPressed,
                  focusSaving && styles.buttonDisabled,
                ]}>
                <Text color={gracePeriod ? theme.text : '#ffd6d2'} variant="label">
                  {gracePeriod ? `Cancelar (${graceSecondsRemaining}s)` : 'Desistir'}
                </Text>
                {gracePeriod ? (
                  <Svg accessibilityElementsHidden height={24} width={24} viewBox="0 0 24 24">
                    <Circle cx={12} cy={12} r={9} fill="none" stroke={theme.border} strokeWidth={2} />
                    <Circle
                      cx={12}
                      cy={12}
                      r={9}
                      fill="none"
                      rotation={-90}
                      origin="12, 12"
                      stroke={theme.accent}
                      strokeDasharray={`${2 * Math.PI * 9 * (graceSecondsRemaining / GRACE_PERIOD_SECONDS)} ${2 * Math.PI * 9}`}
                      strokeLinecap="round"
                      strokeWidth={2}
                    />
                  </Svg>
                ) : null}
              </Pressable>
            </Animated.View>
          </View>
        )}
        {timerStatus === 'idle' ? (
          <Text color={theme.textMuted} style={styles.rewardHint} variant="caption">
            Suas recompensas são calculadas pelo EnergyOS ao concluir.
          </Text>
        ) : null}
      </Card>

      <Modal
        animationType="fade"
        onRequestClose={() => setShowGiveUpConfirm(false)}
        transparent
        visible={showGiveUpConfirm}>
        <View style={styles.modalScrim}>
          <Card accessibilityViewIsModal style={styles.confirmCard}>
            <Text accessibilityRole="header" style={styles.confirmTitle} variant="sectionTitle">
              Tem certeza que quer desistir? Sua energia vai se apagar. 💔
            </Text>
            <View style={styles.confirmActions}>
              <Button
                disabled={focusSaving}
                onPress={() => setShowGiveUpConfirm(false)}
                title="Continuar focando"
              />
              <Pressable
                accessibilityLabel="Confirmar desistência da sessão"
                accessibilityRole="button"
                disabled={focusSaving}
                onPress={() => {
                  setShowGiveUpConfirm(false);
                  void finishFocus(elapsedSeconds, 'gave_up');
                }}
                style={({ pressed }) => [
                  styles.destructiveButton,
                  pressed && styles.buttonPressed,
                  focusSaving && styles.buttonDisabled,
                ]}>
                <Text color="#ffd6d2" variant="label">
                  {focusSaving ? 'Encerrando…' : 'Desistir'}
                </Text>
              </Pressable>
            </View>
          </Card>
        </View>
      </Modal>

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
              <Text
                color={session.endReason === 'gave_up' ? theme.textMuted : theme.orange}
                style={styles.sessionReward}
                variant="caption">
                {session.endReason === 'gave_up' ? '💔 Desistiu · +0' : `+${session.xpEarned} XP`}
              </Text>
            </View>
          ))
        ) : (
          <EmptyState description="Suas sessões concluídas ou interrompidas aparecerão aqui." title="Nenhuma sessão recente" />
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
  actionSlot: { flex: 1 },
  cancelButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 12,
  },
  buttonPressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  buttonDisabled: { opacity: 0.55 },
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
  modalScrim: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  confirmCard: { gap: 20, width: '100%' },
  confirmTitle: { textAlign: 'center' },
  confirmActions: { gap: 10 },
  destructiveButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(177, 77, 70, 0.22)',
    borderColor: '#b14d46',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
});
