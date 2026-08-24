import pool from "../db";
import type { Insight, MetricKind } from "@/types";
import { averagesForRange } from "./checkins";
import { dailyCompletions } from "./tasks";
import { addDaysIso, todayIso, weekStartIso } from "./dates";
import { parseProfileId } from "./validation";

interface InsightRow {
  id: string | number;
  profile_id: string;
  week_start: Date | string;
  kind: MetricKind;
  title: string;
  description: string;
  created_at: Date | string;
}

function mapInsight(row: InsightRow): Insight {
  return {
    id: String(row.id),
    profileId: row.profile_id,
    title: row.title,
    description: row.description,
    metricKind: row.kind,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

interface DraftInsight {
  kind: MetricKind;
  title: string;
  description: string;
}

function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}min`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${String(rest).padStart(2, "0")}min`;
}

function deltaLabel(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Gera (ou atualiza) os insights semanais do perfil a partir dos dados reais do banco. */
export async function generateWeeklyInsights(profileId: string, referenceDate?: string): Promise<Insight[]> {
  parseProfileId(profileId);
  const today = referenceDate ?? todayIso();
  const weekStart = weekStartIso(today);
  const weekEnd = addDaysIso(weekStart, 6);
  const prevStart = addDaysIso(weekStart, -7);
  const prevEnd = addDaysIso(weekStart, -1);

  const [avgNow, avgPrev, completions] = await Promise.all([
    averagesForRange(profileId, weekStart, weekEnd),
    averagesForRange(profileId, prevStart, prevEnd),
    dailyCompletions(profileId, prevStart, weekEnd),
  ]);

  const drafts: DraftInsight[] = [];
  const thisWeekTasks = completions.filter((d) => d.date >= weekStart);
  const prevWeekTasks = completions.filter((d) => d.date < weekStart);

  // Sono
  const sleepDelta = deltaLabel(avgNow.sleepHours ? avgNow.sleepHours * 60 : null, avgPrev.sleepHours ? avgPrev.sleepHours * 60 : null);
  if (avgNow.sleepHours !== null && sleepDelta !== null) {
    drafts.push({
      kind: "sleep",
      title: sleepDelta >= 0 ? `Seu sono melhorou ${sleepDelta}%` : `Seu sono caiu ${Math.abs(sleepDelta)}%`,
      description:
        sleepDelta >= 0
          ? `Média de ${avgNow.sleepHours.toFixed(1)}h nesta semana (semana passada: ${avgPrev.sleepHours?.toFixed(1)}h). Continue assim.`
          : `Média de ${avgNow.sleepHours.toFixed(1)}h contra ${avgPrev.sleepHours?.toFixed(1)}h na semana anterior. Tente antecipar a hora de dormir.`,
    });
  }

  // Estudo
  const studyDelta = deltaLabel(avgNow.studyMinutes, avgPrev.studyMinutes);
  if (avgNow.studyMinutes !== null && studyDelta !== null) {
    drafts.push({
      kind: "study",
      title: studyDelta >= 0 ? `Estudo em alta: +${studyDelta}%` : `Estudo ${studyDelta}% vs. semana anterior`,
      description: `Média de ${formatHours(avgNow.studyMinutes)} por dia com check-in nesta semana.`,
    });
  }

  // Treino
  if (avgNow.trainingMinutes !== null && avgNow.trainingMinutes > 0) {
    drafts.push({
      kind: "training",
      title: `Treino médio de ${formatHours(Math.round(avgNow.trainingMinutes))} por dia ativo`,
      description: `${avgNow.daysWithCheckin} dia(s) com check-in registrado nesta semana.`,
    });
  }

  // Consistência de tarefas (regra dos 50%)
  const rate = (days: typeof completions) => {
    const total = days.reduce((sum, d) => sum + d.total, 0);
    const done = days.reduce((sum, d) => sum + d.completed, 0);
    return total > 0 ? Math.round((done / total) * 100) : null;
  };
  const taskRateNow = rate(thisWeekTasks);
  const taskRatePrev = rate(prevWeekTasks);
  if (taskRateNow !== null) {
    drafts.push({
      kind: "tasks",
      title: taskRateNow >= 50 ? `${taskRateNow}% das tarefas concluídas — streak garantido` : `${taskRateNow}% das tarefas concluídas`,
      description:
        taskRatePrev !== null && taskRateNow < taskRatePrev
          ? `Queda frente aos ${taskRatePrev}% da semana anterior. Escolha menos tarefas e conclua metade delas.`
          : `A meta diária é concluir pelo menos 50% das tarefas do dia para manter o streak.`,
    });
  }

  if (drafts.length === 0) {
    drafts.push({
      kind: "energy",
      title: "Sem dados suficientes ainda",
      description: "Faça check-ins diários e cadastre tarefas para o energyOS gerar insights personalizados.",
    });
  }

  const values: unknown[][] = drafts.map((draft) => [profileId, weekStart, draft.kind, draft.title, draft.description]);
  const placeholders = values.map((_, index) => `($${index * 5 + 1}, $${index * 5 + 2}, $${index * 5 + 3}, $${index * 5 + 4}, $${index * 5 + 5})`).join(", ");
  await pool.query(
    `insert into insights (profile_id, week_start, kind, title, description)
     values ${placeholders}
     on conflict (profile_id, week_start, kind) do update set
       title = excluded.title,
       description = excluded.description,
       created_at = now()`,
    values.flat(),
  );

  return listInsights(profileId, weekStart);
}

export async function listInsights(profileId: string, weekStart?: string): Promise<Insight[]> {
  parseProfileId(profileId);
  const targetWeek = weekStart ?? weekStartIso(todayIso());
  const result = await pool.query<InsightRow>(
    `select id, profile_id, week_start, kind, title, description, created_at
     from insights
     where profile_id = $1 and week_start = $2::date
     order by created_at desc`,
    [profileId, targetWeek],
  );
  return result.rows.map(mapInsight);
}
