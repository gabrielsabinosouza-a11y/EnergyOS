import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { useAuth } from '@/auth/context';
import { useTheme } from '@/hooks/use-theme';
import { ErrorState, Screen, Text } from '@/shared/components';

export default function IndexRoute() {
  const { status, user } = useAuth();
  const theme = useTheme();

  if (status === 'restoring') {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <ActivityIndicator color={theme.accent} size="large" />
        <Text color={theme.textSecondary}>Restaurando sua sessão...</Text>
      </Screen>
    );
  }

  if (status === 'unconfigured') {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <ErrorState
          title="Conecte sua conta EnergyOS"
          description="Configure as variáveis EXPO_PUBLIC_FIREBASE_* no ambiente do app para continuar."
        />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <ErrorState
          title="Não foi possível restaurar sua sessão"
          description="Feche e abra o app novamente. Se o problema continuar, entre outra vez."
        />
      </Screen>
    );
  }

  return <Redirect href={user ? '/(tabs)' : '/(auth)/sign-in'} />;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
