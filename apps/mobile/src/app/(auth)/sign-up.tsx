import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { AuthField } from '@/auth/auth-field';
import { getAuthErrorMessage, useAuth } from '@/auth/context';
import { Button, Card, Screen, Text } from '@/shared/components';
import { useTheme } from '@/hooks/use-theme';

function validatePassword(password: string, confirmation: string) {
  if (password.length < 8 || !/[a-z]/i.test(password) || !/\d/.test(password)) {
    return 'Use pelo menos 8 caracteres, com uma letra e um número.';
  }
  if (password !== confirmation) return 'As senhas não coincidem.';
  return '';
}

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const theme = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSignUp() {
    const validation = validatePassword(password, confirmation);
    if (validation) {
      setError(validation);
      return;
    }

    setBusy(true);
    setError('');
    try {
      await signUp(name, email, password);
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
            SUA JORNADA
          </Text>
          <Text variant="title">Comece com um passo.</Text>
          <Text color={theme.textSecondary}>Crie sua conta EnergyOS.</Text>
        </View>

        <Card style={styles.form}>
          <AuthField
            autoComplete="name"
            label="Como podemos chamar você?"
            onChangeText={setName}
            placeholder="Seu nome"
            textContentType="name"
            value={name}
          />
          <AuthField
            autoComplete="email"
            keyboardType="email-address"
            label="E-mail"
            onChangeText={setEmail}
            placeholder="voce@email.com"
            textContentType="emailAddress"
            value={email}
          />
          <AuthField
            autoComplete="new-password"
            label="Senha"
            onChangeText={setPassword}
            placeholder="Mínimo 8 caracteres, com letra e número"
            secureTextEntry
            textContentType="newPassword"
            value={password}
          />
          <AuthField
            autoComplete="new-password"
            label="Confirmar senha"
            onChangeText={setConfirmation}
            placeholder="Repita sua senha"
            secureTextEntry
            textContentType="newPassword"
            value={confirmation}
          />
          {error ? (
            <Text accessibilityLiveRegion="polite" color={theme.red}>
              {error}
            </Text>
          ) : null}
          <Button
            loading={busy}
            onPress={handleSignUp}
            title="Criar minha conta"
            accessibilityHint="Cria sua conta EnergyOS"
          />
        </Card>

        <View style={styles.footer}>
          <Text color={theme.textSecondary}>Já tem uma conta?</Text>
          <Link href="/(auth)/sign-in" asChild>
            <Button title="Entrar" variant="secondary" />
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
