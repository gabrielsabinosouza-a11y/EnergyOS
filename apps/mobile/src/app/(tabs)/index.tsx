import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/shared/components';
import { useTheme } from '@/hooks/use-theme';

export default function TodayScreen() {
  const theme = useTheme();

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text variant="eyebrow" color={theme.accent}>
            ENERGYOS
          </Text>
          <Text variant="title">Seu dia, no seu ritmo.</Text>
        </View>
        <Text variant="body" color={theme.textSecondary}>
          Um espaço para cuidar do foco, da rotina e do seu bem-estar.
        </Text>
      </View>

      <Card style={styles.heroCard}>
        <View style={[styles.orb, { backgroundColor: theme.purpleBg }]} />
        <Text variant="eyebrow" color={theme.purple}>
          PAINEL DIÁRIO
        </Text>
        <Text variant="heading">Sua jornada começa aqui</Text>
        <Text variant="body" color={theme.textSecondary}>
          Conecte sua conta EnergyOS para ver seu progresso, tarefas e hábitos de hoje.
        </Text>
      </Card>

      <Text variant="sectionTitle">Acesso rápido</Text>
      <View style={styles.actions}>
        <Link href="/planner" asChild>
          <Button title="Planejar meu dia" variant="secondary" />
        </Link>
        <Link href="/focus" asChild>
          <Button title="Começar um foco" />
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 10, paddingTop: 8 },
  heroCard: { gap: 12, overflow: 'hidden', paddingVertical: 24 },
  orb: { borderRadius: 100, height: 128, opacity: 0.6, position: 'absolute', right: -54, top: -54, width: 128 },
  actions: { gap: 12 },
});
