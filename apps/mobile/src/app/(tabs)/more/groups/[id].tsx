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
  sender?: { displayName?: string };
};

function errorText(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível carregar as mensagens.';
}

export default function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [groupName, setGroupName] = useState('Grupo');
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [groupResult, messageResult] = await Promise.all([
        api.get<{ group: { name: string } }>(`/api/groups/${id}`),
        api.get<{ messages: Message[] }>(`/api/groups/${id}/messages`),
      ]);
      setGroupName(groupResult.group.name);
      setMessages(messageResult.messages);
      await api.post(`/api/groups/${id}/read`, {});
      setError('');
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 15_000);
    return () => clearInterval(interval);
  }, [load]);

  async function sendMessage() {
    const body = draft.trim();
    if (!body || sending || !id) return;
    setSending(true);
    setError('');
    try {
      await api.post(`/api/groups/${id}/messages`, { body, messageType: 'text' });
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
        <Text color={theme.purple} variant="eyebrow">GRUPO ENERGYOS</Text>
        <Text variant="title">{groupName}</Text>
        <Text color={theme.textSecondary}>As mensagens são atualizadas periodicamente.</Text>
      </View>
      {error ? <ErrorState description={error} onRetry={() => void load()} title="Conversa indisponível" /> : null}
      {!loading && messages.length === 0 ? <EmptyState description="Envie uma mensagem para começar a conversa." title="Ainda não há mensagens" /> : null}
      {messages.map((message) => (
        <Card key={message.id} style={styles.message}>
          <Text variant="label">{message.sender?.displayName || 'Pessoa do grupo'}</Text>
          <Text>{message.body}</Text>
          <Text color={theme.textMuted} variant="caption">
            {new Date(message.createdAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </Card>
      ))}
      <Card style={styles.composer}>
        <TextInput
          accessibilityLabel="Mensagem para o grupo"
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
