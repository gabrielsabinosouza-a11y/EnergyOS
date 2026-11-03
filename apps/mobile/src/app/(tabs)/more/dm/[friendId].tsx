import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { ApiError, api } from '@/shared/api';
import { Button, Card, EmptyState, ErrorState, Screen, Text } from '@/shared/components';
import { useTheme } from '@/hooks/use-theme';

type Message = {
  id: number;
  body: string;
  createdAt: string;
  senderId?: string;
  sender?: { displayName?: string };
};

function errorText(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível carregar as mensagens.';
}

export default function DirectMessageScreen() {
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const theme = useTheme();
  const [friendName, setFriendName] = useState('Conversa');
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!friendId) return;
    try {
      const [friendResult, messageResult] = await Promise.all([
        api.get<{ friends: { id: string; displayName: string }[] }>('/api/friends'),
        api.get<{ messages: Message[] }>(`/api/dm/${encodeURIComponent(friendId)}`),
      ]);
      setFriendName(friendResult.friends.find((friend) => friend.id === friendId)?.displayName || 'Conversa');
      setMessages(messageResult.messages);
      await api.post(`/api/dm/${encodeURIComponent(friendId)}/read`, {});
      setError('');
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [friendId]);

  useEffect(() => {
    const initialLoad = setTimeout(() => void load(), 0);
    const interval = setInterval(() => void load(), 15_000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [load]);

  async function sendMessage() {
    const body = draft.trim();
    if (!body || sending || !friendId) return;
    setSending(true);
    setError('');
    try {
      await api.post(`/api/dm/${encodeURIComponent(friendId)}`, { body, messageType: 'text' });
      setDraft('');
      await load();
    } catch (sendError) {
      setError(errorText(sendError));
    } finally {
      setSending(false);
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
        <Text color={theme.purple} variant="eyebrow">MENSAGEM DIRETA</Text>
        <Text variant="title">{friendName}</Text>
        <Text color={theme.textSecondary}>A conversa é atualizada periodicamente.</Text>
      </View>
      {error ? <ErrorState description={error} onRetry={() => void load()} title="Conversa indisponível" /> : null}
      {!loading && messages.length === 0 ? <EmptyState description="Envie uma mensagem para iniciar a conversa." title="Ainda não há mensagens" /> : null}
      {messages.map((message) => (
        <Card key={message.id} style={styles.message}>
          {message.sender?.displayName ? <Text variant="label">{message.sender.displayName}</Text> : null}
          <Text>{message.body}</Text>
          <Text color={theme.textMuted} variant="caption">
            {new Date(message.createdAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </Card>
      ))}
      <Card style={styles.composer}>
        <TextInput
          accessibilityLabel="Mensagem direta"
          editable={!sending}
          maxLength={2000}
          multiline
          onChangeText={setDraft}
          placeholder="Escreva uma mensagem"
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { backgroundColor: theme.surfaceHover, borderColor: theme.border, color: theme.text }]}
          value={draft}
        />
        <Button disabled={!draft.trim()} loading={sending} onPress={sendMessage} title="Enviar" />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 10, paddingTop: 8 },
  message: { alignSelf: 'stretch', gap: 8 },
  composer: { gap: 10 },
  input: { borderRadius: 12, borderWidth: 1, maxHeight: 140, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12 },
});
