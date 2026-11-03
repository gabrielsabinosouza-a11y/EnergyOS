import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { ApiError, api } from '@/shared/api';
import { Button, Card, EmptyState, ErrorState, Screen, Text } from '@/shared/components';
import { useTheme } from '@/hooks/use-theme';

type Friend = {
  id: string;
  displayName: string;
  username?: string;
  currentStreak: number;
  friendshipId: number;
  unreadCount: number;
};

type FriendRequest = {
  id: number;
  direction: 'incoming' | 'outgoing';
  user: { id: string; displayName: string; username?: string };
};

type Group = {
  id: number;
  name: string;
  avatarEmoji: string;
  memberCount: number;
  weeklyFocusMinutes: number;
  unreadCount: number;
};

function errorText(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível concluir esta ação.';
}

export default function SocialScreen() {
  const theme = useTheme();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [friendId, setFriendId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [friendResult, requestResult, groupResult] = await Promise.all([
        api.get<{ friends: Friend[] }>('/api/friends'),
        api.get<{ requests: FriendRequest[] }>('/api/friends/requests'),
        api.get<{ groups: Group[] }>('/api/groups'),
      ]);
      setFriends(friendResult.friends);
      setRequests(requestResult.requests);
      setGroups(groupResult.groups);
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

  async function sendRequest() {
    const id = friendId.trim();
    if (!id || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api.post('/api/friends', { addresseeId: id });
      setFriendId('');
      setNotice('Solicitação de amizade enviada.');
      await load();
    } catch (sendError) {
      setError(errorText(sendError));
    } finally {
      setSaving(false);
    }
  }

  async function answerRequest(request: FriendRequest, accept: boolean) {
    if (pendingId !== null) return;
    setPendingId(request.id);
    setError('');
    try {
      if (accept) await api.patch(`/api/friends/${request.id}`, {});
      else await api.delete(`/api/friends/${request.id}`);
      await load();
    } catch (answerError) {
      setError(errorText(answerError));
    } finally {
      setPendingId(null);
    }
  }

  async function createGroup() {
    const name = groupName.trim();
    if (!name || saving) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/api/groups', { name, isPublic: false });
      setGroupName('');
      await load();
    } catch (createError) {
      setError(errorText(createError));
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
        <Text color={theme.purple} variant="eyebrow">JORNADA COMPARTILHADA</Text>
        <Text variant="title">Social</Text>
        <Text color={theme.textSecondary}>Amizades, grupos e conversas em um só lugar.</Text>
      </View>
      {error ? <ErrorState description={error} onRetry={() => void load()} title="Não foi possível carregar sua rede" /> : null}
      {notice ? <Text accessibilityLiveRegion="polite" color={theme.green}>{notice}</Text> : null}

      <Card style={styles.form}>
        <Text variant="sectionTitle">Adicionar amigo</Text>
        <Text color={theme.textSecondary}>Use o ID do perfil para enviar uma solicitação.</Text>
        <TextInput
          accessibilityLabel="ID do perfil para adicionar como amigo"
          autoCapitalize="none"
          onChangeText={setFriendId}
          placeholder="ID do perfil"
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { backgroundColor: theme.surfaceHover, borderColor: theme.border, color: theme.text }]}
          value={friendId}
        />
        <Button disabled={!friendId.trim()} loading={saving} onPress={sendRequest} title="Enviar solicitação" />
      </Card>

      {requests.filter((request) => request.direction === 'incoming').length > 0 ? (
        <View style={styles.section}>
          <Text variant="sectionTitle">Solicitações recebidas</Text>
          {requests.filter((request) => request.direction === 'incoming').map((request) => (
            <Card key={request.id} style={styles.item}>
              <View style={styles.copy}>
                <Text variant="label">{request.user.displayName}</Text>
                {request.user.username ? <Text color={theme.textSecondary}>@{request.user.username}</Text> : null}
              </View>
              <View style={styles.actions}>
                <Button disabled={pendingId !== null} loading={pendingId === request.id} onPress={() => void answerRequest(request, true)} title="Aceitar" />
                <Button disabled={pendingId !== null} onPress={() => void answerRequest(request, false)} title="Recusar" variant="quiet" />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text variant="sectionTitle">Amigos</Text>
        {!loading && friends.length === 0 ? <EmptyState description="Convide alguém para acompanhar metas e foco junto com você." title="Sua rede começa aqui" /> : null}
        {friends.map((friend) => (
          <Card key={friend.id} style={styles.item}>
            <View style={styles.copy}>
              <Text variant="label">{friend.displayName}</Text>
              <Text color={theme.textSecondary}>
                {friend.username ? `@${friend.username} · ` : ''}{friend.currentStreak} dias de sequência
              </Text>
            </View>
            <Button
              accessibilityLabel={`Abrir conversa com ${friend.displayName}`}
              onPress={() => router.push({ pathname: '/more/dm/[friendId]', params: { friendId: friend.id } })}
              title={friend.unreadCount ? `Chat · ${friend.unreadCount}` : 'Chat'}
              variant="secondary"
            />
          </Card>
        ))}
      </View>

      <Card style={styles.form}>
        <Text variant="sectionTitle">Criar grupo</Text>
        <TextInput
          accessibilityLabel="Nome do grupo"
          maxLength={60}
          onChangeText={setGroupName}
          placeholder="Nome do grupo"
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { backgroundColor: theme.surfaceHover, borderColor: theme.border, color: theme.text }]}
          value={groupName}
        />
        <Button disabled={!groupName.trim()} loading={saving} onPress={createGroup} title="Criar grupo" variant="secondary" />
      </Card>

      <View style={styles.section}>
        <Text variant="sectionTitle">Grupos</Text>
        {!loading && groups.length === 0 ? <EmptyState description="Crie um grupo para dividir desafios e celebrar avanços." title="Nenhum grupo ainda" /> : null}
        {groups.map((group) => (
          <Card key={group.id} style={styles.item}>
            <View style={styles.copy}>
              <Text variant="label">{group.avatarEmoji || '✦'}  {group.name}</Text>
              <Text color={theme.textSecondary}>
                {group.memberCount} pessoas · {group.weeklyFocusMinutes} min de foco nesta semana
              </Text>
            </View>
            <Button
              accessibilityLabel={`Abrir grupo ${group.name}`}
              onPress={() => router.push({ pathname: '/more/groups/[id]', params: { id: String(group.id) } })}
              title={group.unreadCount ? `Abrir · ${group.unreadCount}` : 'Abrir'}
              variant="secondary"
            />
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 10, paddingTop: 8 },
  section: { gap: 12 },
  form: { gap: 12 },
  input: { borderRadius: 12, borderWidth: 1, minHeight: 48, paddingHorizontal: 14 },
  item: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  copy: { flex: 1, gap: 4 },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 6 },
});
