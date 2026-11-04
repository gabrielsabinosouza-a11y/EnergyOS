import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth, getAuthErrorMessage } from '@/auth/context';
import { ApiError, api } from '@/shared/api';
import { Button, Card, Screen, Text } from '@/shared/components';
import { useTheme } from '@/hooks/use-theme';

type ProfileData = {
  displayName: string;
  username?: string;
  currentStreak: number;
  longestStreak: number;
};

export default function ProfileScreen() {
  const { signOutUser, user } = useAuth();
  const theme = useTheme();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      const result = await api.get<{ user: ProfileData }>('/api/profile');
      setProfile(result.user);
      setName(result.user.displayName);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'Não foi possível carregar seu perfil.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => void loadProfile(), 0);
    return () => clearTimeout(timer);
  }, [loadProfile, user]);

  async function saveName() {
    const displayName = name.trim();
    if (!displayName || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.patch<{ user: ProfileData }>('/api/profile', { displayName });
      setProfile(result.user);
      setName(result.user.displayName);
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : 'Não foi possível atualizar seu perfil.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    setError('');
    try {
      await signOutUser();
    } catch (signOutError) {
      setError(getAuthErrorMessage(signOutError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.heading}>
        <Text color={theme.accent} variant="eyebrow">
          SUA CONTA
        </Text>
        <Text variant="title">Seu perfil</Text>
      </View>
      {__DEV__ ? (
        <Button
          onPress={() => router.push('/ui-playground')}
          title="Prévia do sistema visual"
          variant="quiet"
        />
      ) : null}
      <Card style={styles.card}>
        <Text variant="heading">{profile?.displayName || user?.displayName || 'Pessoa EnergyOS'}</Text>
        <Text color={theme.textSecondary}>{user?.email}</Text>
        {profile?.username ? <Text color={theme.accent}>@{profile.username}</Text> : null}
        {profile ? (
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text color={theme.textSecondary} variant="caption">SEQUÊNCIA ATUAL</Text>
              <Text color={theme.orange} variant="heading">{profile.currentStreak} dias</Text>
            </View>
            <View style={styles.stat}>
              <Text color={theme.textSecondary} variant="caption">MELHOR SEQUÊNCIA</Text>
              <Text color={theme.purple} variant="heading">{profile.longestStreak} dias</Text>
            </View>
          </View>
        ) : null}
        <TextInput
          accessibilityLabel="Nome de exibição"
          editable={!busy}
          maxLength={80}
          onChangeText={setName}
          placeholder="Seu nome"
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { backgroundColor: theme.surfaceHover, borderColor: theme.border, color: theme.text }]}
          value={name}
        />
        <Button disabled={!name.trim() || name.trim() === profile?.displayName} loading={busy} onPress={saveName} title="Salvar nome" variant="secondary" />
        {error ? (
          <Text accessibilityLiveRegion="polite" color={theme.red}>
            {error}
          </Text>
        ) : null}
        {loading ? <Text color={theme.textSecondary}>Carregando perfil…</Text> : null}
      </Card>

      <View style={styles.section}>
        <Text variant="sectionTitle">Sua jornada</Text>
        <Button onPress={() => router.push('/more/goals')} title="Metas" variant="secondary" />
        <Button onPress={() => router.push('/more/achievements')} title="Conquistas" variant="secondary" />
        <Button onPress={() => router.push('/more/reports')} title="Relatórios e consistência" variant="secondary" />
      </View>
      <View style={styles.section}>
        <Text variant="sectionTitle">Energia e recompensas</Text>
        <Button onPress={() => router.push('/more/league')} title="Liga" variant="secondary" />
        <Button onPress={() => router.push('/more/store')} title="Loja" variant="secondary" />
        <Button onPress={() => router.push('/more/garden')} title="Jardim" variant="secondary" />
      </View>
      <Card style={styles.card}>
        <Text variant="sectionTitle">Conta</Text>
        <Button onPress={() => router.push('/more/settings')} title="Configurações" variant="secondary" />
        <Button
          loading={busy}
          onPress={handleSignOut}
          title="Sair da conta"
          variant="secondary"
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 10, paddingTop: 8 },
  card: { alignItems: 'stretch', gap: 12 },
  section: { gap: 10 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, gap: 5 },
  input: { borderRadius: 12, borderWidth: 1, minHeight: 48, paddingHorizontal: 14 },
});
