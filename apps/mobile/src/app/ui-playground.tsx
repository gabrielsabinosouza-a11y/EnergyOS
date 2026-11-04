import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { StatusBar } from 'expo-status-bar';

import {
  AchievementMedal,
  Avatar,
  Badge,
  BottomSheet,
  Chip,
  EmptyState,
  GlassCard,
  GradientButton,
  ListRow,
  PressableScale,
  ProgressBar,
  SectionHeader,
  Skeleton,
  StatCard,
  Toast,
} from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

export default function UiPlaygroundScreen() {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const dismissToast = useCallback(() => setToastVisible(false), []);
  const showToast = useCallback(() => setToastVisible(true), []);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.deepNavy, '#0B1730', colors.deepNavy]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300 }}>
          <Text style={styles.eyebrow}>ENERGYOS · SISTEMA VISUAL</Text>
          <Text style={styles.title}>UI Playground</Text>
          <Text style={styles.subtitle}>Componentes compartilhados para a experiência mobile.</Text>
        </MotiView>

        <GlassCard style={styles.hero}>
          <View style={styles.heroTop}>
            <Avatar
              name="Marina Costa"
              size={64}
              badge={<Badge label="ADMIN" color={colors.amber} backgroundColor="rgba(255,215,107,0.12)" />}
            />
            <View style={styles.heroCopy}>
              <Text style={styles.heroName}>Marina Costa</Text>
              <Text style={styles.heroMeta}>@marinacosta · Membro desde 2024</Text>
            </View>
            <Chip label="NÍVEL 12" color={colors.purple} backgroundColor={colors.purpleBg} />
          </View>
          <View style={styles.heroStats}>
            <StatCard label="SEQUÊNCIA" value="12 dias" color={colors.amber} icon={<Text>🔥</Text>} index={0} />
            <StatCard label="FOCO NA SEMANA" value="8h 40min" color={colors.purple} icon={<Text>✦</Text>} index={1} />
          </View>
        </GlassCard>

        <SectionHeader
          title="Conquistas"
          subtitle="Medalhas, progressos e estados"
          icon={<Text style={styles.sectionIcon}>✦</Text>}
        />
        <GlassCard blur={false}>
          <ScrollView
            contentContainerStyle={styles.medalRow}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={124}
            decelerationRate="fast">
            <AchievementMedal title="Top 1 Global" icon="🏆" rarity="legendary" />
            <AchievementMedal title="Mente focada" icon="🧠" rarity="epic" />
            <AchievementMedal title="Primeira semana" icon="🌱" rarity="rare" locked progress={0.62} />
          </ScrollView>
        </GlassCard>

        <SectionHeader title="Progresso e etiquetas" />
        <GlassCard blur={false} style={styles.progressCard}>
          <View style={styles.progressHeading}>
            <Text style={styles.cardTitle}>Sua próxima conquista</Text>
            <Text style={styles.progressValue}>68%</Text>
          </View>
          <ProgressBar progress={0.68} color={colors.purple} height={10} />
          <View style={styles.badgeRow}>
            <Badge label="ADMIN" color={colors.amber} backgroundColor="rgba(255,215,107,0.12)" />
            <Chip label="ÉPICO" color={colors.purple} backgroundColor={colors.purpleBg} />
            <Badge label="AO VIVO" color={colors.success} backgroundColor="rgba(74,222,128,0.10)" />
          </View>
        </GlassCard>

        <SectionHeader title="Ações e navegação" subtitle="Toque para ver os estados interativos" />
        <GlassCard blur={false} style={styles.actionCard}>
          <ListRow
            title="Sua jornada"
            subtitle="Metas, conquistas e relatórios"
            icon={<Text style={styles.rowIcon}>✧</Text>}
            onPress={showToast}
          />
          <ListRow
            title="Energia e recompensas"
            subtitle="Liga Ouro · 240 moedas"
            icon={<Text style={[styles.rowIcon, { color: colors.amber }]}>◈</Text>}
            trailing={<Text style={styles.trailing}>240 ◉</Text>}
            onPress={showToast}
          />
          <PressableScale accessibilityRole="button" onPress={showToast} style={styles.pressDemo}>
            <Text style={styles.pressDemoText}>PressableScale · feedback háptico</Text>
          </PressableScale>
          <GradientButton title="Ação principal" icon={<Text>✦</Text>} onPress={showToast} />
          <GradientButton title="Ação secundária" variant="secondary" onPress={showToast} />
          <GradientButton title="Ação discreta" variant="ghost" onPress={showToast} />
          <GradientButton title="Carregando" loading onPress={showToast} />
        </GlassCard>

        <SectionHeader title="Estados" />
        <GlassCard blur={false} style={styles.stateCard}>
          <View style={styles.skeletonBlock}>
            <Skeleton style={styles.skeletonTitle} />
            <Skeleton style={styles.skeletonLine} />
            <Skeleton style={styles.skeletonLineShort} />
          </View>
          <View style={styles.divider} />
          <EmptyState
            title="Tudo pronto para começar"
            description="Quando houver novidades, elas aparecerão aqui."
            icon={<Text style={styles.emptyIcon}>✦</Text>}
            actionLabel="Ver conquistas"
            onAction={showToast}
          />
        </GlassCard>

        <GradientButton
          title="Abrir BottomSheet"
          icon={<Text>⌃</Text>}
          onPress={() => setSheetVisible(true)}
        />
      </ScrollView>

      <Toast
        message="Progresso salvo com sucesso."
        onDismiss={dismissToast}
        visible={toastVisible}
      />
      <BottomSheet
        onClose={() => setSheetVisible(false)}
        title="Detalhes da conquista"
        visible={sheetVisible}>
        <View style={styles.sheetBody}>
          <AchievementMedal title="Top 1 Global" icon="🏆" rarity="legendary" />
          <Text style={styles.sheetCopy}>
            Um painel com detalhes, progresso e ações cabe aqui sem alterar a navegação existente.
          </Text>
          <GradientButton title="Entendi" onPress={() => setSheetVisible(false)} />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.deepNavy, flex: 1 },
  content: { gap: spacing.lg, paddingBottom: 40, paddingHorizontal: 20, paddingTop: 24 },
  eyebrow: { ...typography.caption, color: colors.primary, letterSpacing: 1.5 },
  title: { ...typography.display, color: colors.text, marginTop: 8 },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: 5 },
  hero: { borderRadius: radii.lg },
  heroTop: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 22 },
  heroCopy: { flex: 1, gap: 4 },
  heroName: { ...typography.heading, color: colors.text },
  heroMeta: { ...typography.caption, color: colors.textSecondary },
  heroStats: { flexDirection: 'row', gap: 10 },
  sectionIcon: { color: colors.amber, fontSize: 20 },
  medalRow: { gap: 12, paddingVertical: 2 },
  progressCard: { gap: 16 },
  progressHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { ...typography.label, color: colors.text },
  progressValue: { ...typography.mono, color: colors.purple, fontVariant: ['tabular-nums'] },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionCard: { gap: 10 },
  rowIcon: { color: colors.primary, fontSize: 22 },
  trailing: { ...typography.caption, color: colors.amber },
  pressDemo: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radii.md,
    justifyContent: 'center',
    minHeight: 48,
  },
  pressDemoText: { ...typography.label, color: colors.textSecondary },
  stateCard: { gap: 18 },
  skeletonBlock: { gap: 10, paddingHorizontal: 6, paddingTop: 4 },
  skeletonTitle: { height: 18, width: '52%' },
  skeletonLine: { height: 12, width: '92%' },
  skeletonLineShort: { height: 12, width: '67%' },
  divider: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth },
  emptyIcon: { color: colors.primary, fontSize: 32 },
  sheetBody: { alignItems: 'center', gap: 12, paddingBottom: 12 },
  sheetCopy: { ...typography.body, color: colors.textSecondary, maxWidth: 300, textAlign: 'center' },
});
