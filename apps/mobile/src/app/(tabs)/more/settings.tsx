import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ApiError, api } from '@/shared/api';
import { Button, Card, ErrorState, Screen, Text } from '@/shared/components';
import { useTheme } from '@/hooks/use-theme';

type Settings = {
  notificationsEnabled: boolean;
  preferredTheme: 'system' | 'light' | 'dark';
  sleepTime?: string;
  focusTime?: string;
  coins: number;
  soundNotificationsEnabled: boolean;
  onboardingCompleted: boolean;
  reminderCheckinEnabled: boolean;
  reminderFocusEnabled: boolean;
  reminderSleepEnabled: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  notificationsEnabled: true,
  preferredTheme: 'dark',
  coins: 0,
  soundNotificationsEnabled: true,
  onboardingCompleted: true,
  reminderCheckinEnabled: false,
  reminderFocusEnabled: false,
  reminderSleepEnabled: false,
};

function errorText(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível salvar suas preferências.';
}

export default function SettingsScreen() {
  const theme = useTheme();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await api.get<Settings>('/api/settings');
      setSettings({ ...DEFAULT_SETTINGS, ...result });
      setError('');
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await api.put<Settings>('/api/settings', settings);
      setSettings({ ...DEFAULT_SETTINGS, ...saved });
      setNotice('Preferências salvas.');
    } catch (saveError) {
      setError(errorText(saveError));
    } finally {
      setSaving(false);
    }
  }

  const switchRow = (
    title: string,
    key: 'notificationsEnabled' | 'soundNotificationsEnabled' | 'reminderCheckinEnabled' | 'reminderFocusEnabled' | 'reminderSleepEnabled',
  ) => (
    <View style={[styles.setting, { borderBottomColor: theme.border }]} key={key}>
      <Text style={styles.settingTitle}>{title}</Text>
      <Switch
        accessibilityLabel={title}
        onValueChange={(value) => update(key, value)}
        thumbColor={settings[key] ? theme.accent : theme.textMuted}
        trackColor={{ false: theme.borderStrong, true: theme.accentBg }}
        value={Boolean(settings[key])}
      />
    </View>
  );

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
        <Text color={theme.accent} variant="eyebrow">SUA CONTA</Text>
        <Text variant="title">Configurações</Text>
        <Text color={theme.textSecondary}>Ajuste sua experiência e seus lembretes.</Text>
      </View>
      {error ? <ErrorState description={error} onRetry={() => void load()} title="Configurações indisponíveis" /> : null}
      {loading ? <Text color={theme.textSecondary}>Carregando preferências…</Text> : null}
      <Card style={styles.card}>
        <Text variant="sectionTitle">Notificações</Text>
        {switchRow('Notificações', 'notificationsEnabled')}
        {switchRow('Sons de notificação', 'soundNotificationsEnabled')}
        {switchRow('Lembrete de check-in', 'reminderCheckinEnabled')}
        {switchRow('Lembrete de foco', 'reminderFocusEnabled')}
        {switchRow('Lembrete de sono', 'reminderSleepEnabled')}
      </Card>
      <Card style={styles.card}>
        <Text variant="sectionTitle">Rotina</Text>
        <Text color={theme.textSecondary}>Horários no fuso de São Paulo.</Text>
        <TextInput
          accessibilityLabel="Horário habitual de foco"
          onChangeText={(value) => update('focusTime', value)}
          placeholder="Foco · HH:MM"
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { backgroundColor: theme.surfaceHover, borderColor: theme.border, color: theme.text }]}
          value={settings.focusTime || ''}
        />
        <TextInput
          accessibilityLabel="Horário habitual de sono"
          onChangeText={(value) => update('sleepTime', value)}
          placeholder="Sono · HH:MM"
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { backgroundColor: theme.surfaceHover, borderColor: theme.border, color: theme.text }]}
          value={settings.sleepTime || ''}
        />
      </Card>
      <Card style={styles.card}>
        <Text variant="sectionTitle">Tema</Text>
        <View style={styles.themes}>
          {(['system', 'light', 'dark'] as const).map((value) => (
            <Button
              key={value}
              onPress={() => update('preferredTheme', value)}
              title={value === 'system' ? 'Sistema' : value === 'light' ? 'Claro' : 'Escuro'}
              variant={settings.preferredTheme === value ? 'primary' : 'secondary'}
            />
          ))}
        </View>
      </Card>
      {notice ? <Text accessibilityLiveRegion="polite" color={theme.green}>{notice}</Text> : null}
      <Button disabled={loading} loading={saving} onPress={save} title="Salvar configurações" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 10, paddingTop: 8 },
  card: { gap: 12 },
  setting: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52 },
  settingTitle: { flex: 1, paddingRight: 12 },
  input: { borderRadius: 12, borderWidth: 1, minHeight: 48, paddingHorizontal: 14 },
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
