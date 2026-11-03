import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { ApiError, api } from '@/shared/api';
import { Button, Card, EmptyState, ErrorState, Screen, Text } from '@/shared/components';
import { useTheme } from '@/hooks/use-theme';

type FocusSession = {
  id: number;
  startedAt: string;
  durationMinutes: number;
  xpEarned: number;
};

type FocusState = {
  history: FocusSession[];
  todayStats: { totalMinutes?: number; sessionsCount?: number };
  lifetimeFocusMinutes: number;
  xp: { level?: number; totalXP?: number };
};

type FocusRoom = {
  id: number;
  name?: string;
  code?: string;
  status?: string;
  durationMinutes?: number;
  participants?: Array<{ displayName?: string }>;
};

function errorText(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível concluir esta ação.';
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const rest = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

export default function FocusScreen() {
  const theme = useTheme();
  const [focus, setFocus] = useState<FocusState | null>(null);
  const [rooms, setRooms] = useState<FocusRoom[]>([]);
  const [activeSession, setActiveSession] = useState<FocusSession | null>(null);
  const [targetMinutes, setTargetMinutes] = useState('25');
  const [roomMinutes, setRoomMinutes] = useState('25');
  const [joinCode, setJoinCode] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeSession) return;
    const update = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000));
      setSeconds(elapsed);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  async function startFocus() {
    const duration = Number(targetMinutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 180) {
      setError('Escolha uma duração entre 1 e 180 minutos.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await api.post<{ session: FocusSession }>('/api/focus', {
        action: 'start',
        targetDurationMinutes: duration,
      });
      setActiveSession(result.session);
    } catch (startError) {
      setError(errorText(startError));
    } finally {
      setSaving(false);
    }
  }

  async function finishFocus() {
    if (!activeSession || saving) return;
    setSaving(true);
    setError('');
    try {
      const result = await api.post<{ xpAwarded: number; coinsAwarded: number }>('/api/focus', {
        action: 'end',
        sessionId: activeSession.id,
        focusedSeconds: seconds,
        pausedCount: 0,
      });
      setActiveSession(null);
      setSeconds(0);
      setNotice(`Sessão registrada · +${result.xpAwarded} XP · +${result.coinsAwarded} moedas`);
      await load();
    } catch (finishError) {
      setError(errorText(finishError));
    } finally {
      setSaving(false);
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
      const result = await api.post<{ message?: string }>(`/api/focus-rooms/${encodeURIComponent(code)}/join`, {});
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
      {error ? <ErrorState description={error} onRetry={() => void load()} title="Não foi possível atualizar o foco" /> : null}
      {notice ? <Text accessibilityLiveRegion="polite" color={theme.green}>{notice}</Text> : null}

      <Card style={styles.center}>
        <Text color={theme.textSecondary} variant="caption">SESSÃO PESSOAL</Text>
        <Text color={theme.accent} style={styles.timer} variant="title">
          {activeSession ? formatTime(Math.max(0, Number(activeSession.durationMinutes) * 60 - seconds)) : `${targetMinutes}:00`}
        </Text>
        {activeSession ? (
          <>
            <Text color={theme.textSecondary}>Sessão ativa · os dados de conclusão são salvos no servidor.</Text>
            <Button loading={saving} onPress={finishFocus} title="Encerrar sessão" />
          </>
        ) : (
          <>
            <TextInput
              accessibilityLabel="Duração da sessão de foco em minutos"
              keyboardType="number-pad"
              maxLength={3}
              onChangeText={setTargetMinutes}
              style={[styles.minutesInput, { backgroundColor: theme.surfaceHover, borderColor: theme.border, color: theme.text }]}
              value={targetMinutes}
            />
            <Button loading={saving} onPress={startFocus} title="Começar a focar" />
          </>
        )}
      </Card>

      <View style={styles.stats}>
        <Card style={styles.stat}><Text color={theme.textSecondary} variant="caption">HOJE</Text><Text color={theme.purple} variant="heading">{focus?.todayStats?.totalMinutes ?? 0} min</Text></Card>
        <Card style={styles.stat}><Text color={theme.textSecondary} variant="caption">NO TOTAL</Text><Text color={theme.green} variant="heading">{focus?.lifetimeFocusMinutes ?? 0} min</Text></Card>
      </View>

      <Card style={styles.form}>
        <Text variant="sectionTitle">Salas de foco</Text>
        <Text color={theme.textSecondary}>Crie uma sala para convidar pessoas ou entre com um código.</Text>
        <View style={styles.row}>
          <TextInput
            accessibilityLabel="Duração da sala em minutos"
            keyboardType="number-pad"
            maxLength={3}
            onChangeText={setRoomMinutes}
            placeholder="Minutos"
            placeholderTextColor={theme.textMuted}
            style={[styles.minutesInput, styles.roomMinutes, { backgroundColor: theme.surfaceHover, borderColor: theme.border, color: theme.text }]}
            value={roomMinutes}
          />
          <Button loading={saving} onPress={createRoom} title="Criar sala" variant="secondary" />
        </View>
        <View style={styles.row}>
          <TextInput
            accessibilityLabel="Código da sala"
            autoCapitalize="characters"
            maxLength={24}
            onChangeText={setJoinCode}
            placeholder="Código da sala"
            placeholderTextColor={theme.textMuted}
            style={[styles.minutesInput, { backgroundColor: theme.surfaceHover, borderColor: theme.border, color: theme.text }]}
            value={joinCode}
          />
          <Button disabled={!joinCode.trim()} loading={saving} onPress={joinRoom} title="Entrar" />
        </View>
      </Card>

      {loading && !focus ? <Text color={theme.textSecondary}>Carregando seu histórico…</Text> : null}
      {!loading && rooms.length === 0 ? <EmptyState description="Crie uma sala ou entre usando um convite." title="Nenhuma sala recente" /> : null}
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
  center: { alignItems: 'center', gap: 14, paddingVertical: 24 },
  timer: { fontVariant: ['tabular-nums'], fontSize: 46, lineHeight: 56 },
  minutesInput: { borderRadius: 12, borderWidth: 1, flex: 1, minHeight: 48, paddingHorizontal: 14, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, gap: 8 },
  form: { gap: 12 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  roomMinutes: { flex: 0.6 },
  room: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  roomCopy: { flex: 1, gap: 4 },
});
