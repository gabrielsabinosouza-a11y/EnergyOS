import { useState } from 'react';
import { View, StyleSheet } from 'react-native';

import { useAuth, getAuthErrorMessage } from '@/auth/context';
import { Button, Card, FeatureLanding, Screen, Text } from '@/shared/components';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileScreen() {
  const { signOutUser, user } = useAuth();
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!user) {
    return (
      <FeatureLanding
        eyebrow="SUA CONTA"
        title="Perfil"
        description="Seu progresso, suas conquistas e suas preferências."
        detail="Entre na sua conta EnergyOS para consultar e atualizar seu perfil."
      />
    );
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
        <Text variant="title">Perfil</Text>
      </View>
      <Card style={styles.card}>
        <Text variant="heading">{user.displayName || 'Pessoa EnergyOS'}</Text>
        <Text color={theme.textSecondary}>{user.email}</Text>
        {error ? (
          <Text accessibilityLiveRegion="polite" color={theme.red}>
            {error}
          </Text>
        ) : null}
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
  card: { alignItems: 'flex-start', gap: 12 },
});
