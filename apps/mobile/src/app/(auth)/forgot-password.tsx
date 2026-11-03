import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { AuthField } from '@/auth/auth-field';
import { getAuthErrorMessage, useAuth } from '@/auth/context';
import { Button, Card, Screen, Text } from '@/shared/components';
import { useTheme } from '@/hooks/use-theme';

export default function ForgotPasswordScreen() {
  const { sendResetEmail } = useAuth();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleReset() {
    setBusy(true);
    setError('');
    setSent(false);
    try {
      await sendResetEmail(email);
      setSent(true);
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
            RECUPERAÇÃO DE ACESSO
          </Text>
          <Text variant="title">Vamos ajudar você a voltar.</Text>
          <Text color={theme.textSecondary}>
            Enviaremos as instruções para redefinir sua senha ao e-mail informado.
          </Text>
        </View>
        <Card style={styles.form}>
          <AuthField
            autoComplete="email"
            keyboardType="email-address"
            label="E-mail da sua conta"
            onChangeText={setEmail}
            placeholder="voce@email.com"
            textContentType="emailAddress"
            value={email}
          />
          {sent ? (
            <Text accessibilityLiveRegion="polite" color={theme.green}>
              Se houver uma conta com esse e-mail, você receberá as instruções em instantes.
            </Text>
          ) : null}
          {error ? (
            <Text accessibilityLiveRegion="polite" color={theme.red}>
              {error}
            </Text>
          ) : null}
          <Button loading={busy} onPress={handleReset} title="Enviar instruções" />
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 10, marginBottom: 24, paddingTop: 16 },
  form: { gap: 16 },
});
