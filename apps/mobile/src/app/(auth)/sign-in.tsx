import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { AuthField } from '@/auth/auth-field';
import { getAuthErrorMessage, useAuth } from '@/auth/context';
import { Button, Card, Screen, Text } from '@/shared/components';
import { useTheme } from '@/hooks/use-theme';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSignIn() {
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.heading}>
          <Text color={theme.accent} variant="eyebrow">
            ENERGYOS
          </Text>
          <Text variant="title">Que bom ter você de volta.</Text>
          <Text color={theme.textSecondary}>Entre para continuar sua jornada.</Text>
        </View>

        <Card style={styles.form}>
          <AuthField
            autoComplete="email"
            keyboardType="email-address"
            label="E-mail"
            onChangeText={setEmail}
            placeholder="voce@email.com"
            returnKeyType="next"
            textContentType="emailAddress"
            value={email}
          />
          <AuthField
            autoComplete="current-password"
            label="Senha"
            onChangeText={setPassword}
            onSubmitEditing={handleSignIn}
            placeholder="Sua senha"
            returnKeyType="go"
            secureTextEntry
            textContentType="password"
            value={password}
          />
          {error ? (
            <Text accessibilityLiveRegion="polite" color={theme.red}>
              {error}
            </Text>
          ) : null}
          <Button
            loading={busy}
            onPress={handleSignIn}
            title="Entrar"
            accessibilityHint="Acessa sua conta EnergyOS"
          />
          <Link href="/(auth)/forgot-password" asChild>
            <Button title="Esqueci minha senha" variant="quiet" />
          </Link>
        </Card>

        <View style={styles.footer}>
          <Text color={theme.textSecondary}>Ainda não tem uma conta?</Text>
          <Link href="/(auth)/sign-up" asChild>
            <Button title="Criar conta" variant="secondary" />
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 10, marginBottom: 24, paddingTop: 16 },
  form: { gap: 16 },
  footer: { alignItems: 'center', gap: 12, marginTop: 24 },
});
