import pool from "../db";
import type { StreakDayStatus, Task } from "@/types";
import { NotFoundError } from "../errors";
import { ValidationError, parseDate, parseProfileId, parseTitle } from "./validation";
import { APP_TIMEZONE, addDaysIso, todayIso } from "./dates";
import { consumeShield, getShieldCount, isDayProtected, logStreakDay, getEquippedShieldDesignId, getStreakShieldDesignById } from "./store";
import { calculateStreak } from "@/lib/streak";
import { reconcileStreak, SHIELD_POLICY } from "@/lib/streak-reconcile";
import { STREAK_COMPLETION_THRESHOLD } from "@/lib/daily-limits";
import { assertCategoryForProfile, resolveDefaultCategoryId } from "./categories";
import { recordMissionProgress } from "./daily-quests";

function assertTaskId(taskId: number): void {
  if (!Number.isInteger(taskId) || taskId <= 0) throw new ValidationError("Tarefa inválida.");
}

/** Colunas de task + categoria resolvida (join com categories). */
const TASK_SELECT = `
  select t.id, t.profile_id, t.title, t.due_date, t.completed_at,
         c.id as category_id, c.user_id as category_user_id, c.name as category_name,
         c.color as category_color, c.icon as category_icon, c.is_custom as category_is_custom,
         c.created_at as category_created_at
  from tasks t
  join categories c on c.id = t.category_id`;

interface TaskRow {
  id: string | number;
  profile_id: string;
  title: string;
  due_date: Date | string;
  completed_at: Date | string | null;
  category_id: string | number;
  category_user_id: string | null;
  category_name: string;
  category_color: string;
  category_icon: string | null;
  category_is_custom: boolean;
  category_created_at: Date | string;
}

function mapTask(row: TaskRow): Task {
  return {
    id: Number(row.id),
    profileId: row.profile_id,
    title: row.title,
    categoryId: Number(row.category_id),
    category: {
      id: Number(row.category_id),
      userId: row.category_user_id,
      name: row.category_name,
      color: row.category_color,
      icon: row.category_icon,
      isCustom: row.category_is_custom,
      createdAt: typeof row.category_created_at === "string"
        ? row.category_created_at
        : row.category_created_at.toISOString(),
    },
    dueDate: typeof row.due_date === "string" ? row.due_date : row.due_date.toISOString().slice(0, 10),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
  };
}

export interface TaskProgress {
  completed: number;
  total: number;
  percentage: number;
  streakQualified: boolean;
}

/** Percentual de conclusão do dia — calculado SEMPRE no backend (regra de 50% do streak). */
export function computeProgress(tasks: Task[]): TaskProgress {
  const total = tasks.length;
  if (total === 0) return { completed: 0, total: 0, percentage: 0, streakQualified: false };
  const completed = tasks.filter((task) => Boolean(task.completedAt)).length;
  const percentage = Math.round((completed / total) * 100);
  return { completed, total, percentage, streakQualified: percentage >= 50 };
}

export async function listTasksByDate(profileId: string, date: string): Promise<Task[]> {
  parseProfileId(profileId);
  const result = await pool.query<TaskRow>(
    `${TASK_SELECT}
     where t.profile_id = $1 and t.due_date = $2::date
     order by t.completed_at asc nulls last, t.id asc`,
    [profileId, date],
  );
  return result.rows.map(mapTask);
}

export async function createTask(
  profileId: string,
  input: { title: string; categoryId?: number; dueDate?: string },
  today: string,
): Promise<Task> {
  parseProfileId(profileId);
  const title = parseTitle(input.title);
  const dueDate = parseDate(input.dueDate, "Data da tarefa", today);
  const categoryId = input.categoryId !== undefined
    ? await assertCategoryForProfile(profileId, input.categoryId)
    : await resolveDefaultCategoryId();

  const inserted = await pool.query<{ id: string | number }>(
    `insert into tasks (profile_id, title, category_id, due_date)
     values ($1, $2, $3, $4::date)
     returning id`,
    [profileId, title, categoryId, dueDate],
  );
  const result = await pool.query<TaskRow>(`${TASK_SELECT} where t.id = $1`, [inserted.rows[0].id]);
  return mapTask(result.rows[0]);
}

export interface UpdateTaskPatch {
  title?: string;
  categoryId?: number;
  dueDate?: string;
}

export async function updateTask(profileId: string, taskId: number, patch: UpdateTaskPatch): Promise<Task> {
  parseProfileId(profileId);
  assertTaskId(taskId);

  const updates: string[] = [];
  const values: (string | number)[] = [profileId, taskId];

  if (patch.title !== undefined) {
    values.push(parseTitle(patch.title));
    updates.push(`title = $${values.length}`);
  }
  if (patch.categoryId !== undefined) {
    const categoryId = await assertCategoryForProfile(profileId, patch.categoryId);
    values.push(categoryId);
    updates.push(`category_id = $${values.length}`);
  }
  if (patch.dueDate !== undefined) {
    values.push(parseDate(patch.dueDate, "Data da tarefa"));
    updates.push(`due_date = $${values.length}::date`);
  }
  if (updates.length === 0) throw new ValidationError("Nenhum campo para atualizar.");

  const updated = await pool.query<{ id: string | number }>(
    `update tasks set ${updates.join(", ")}
     where profile_id = $1 and id = $2
     returning id`,
    values,
  );
  if (!updated.rows[0]) throw new NotFoundError("Tarefa não encontrada.");
  const result = await pool.query<TaskRow>(`${TASK_SELECT} where t.id = $1`, [updated.rows[0].id]);
  return mapTask(result.rows[0]);
}

export async function setTaskCompleted(profileId: string, taskId: number, completed: boolean): Promise<Task> {
  parseProfileId(profileId);
  assertTaskId(taskId);
  const updated = await pool.query<{ id: string | number }>(
    `update tasks set completed_at = case when $3 then now() else null end
     where profile_id = $1 and id = $2
     returning id`,
    [profileId, taskId, completed],
  );
  if (!updated.rows[0]) throw new NotFoundError("Tarefa não encontrada.");
  if (completed) {
    await recordMissionProgress(profileId, "TASKS_COMPLETED", { incrementBy: 1 });
  }
  const result = await pool.query<TaskRow>(`${TASK_SELECT} where t.id = $1`, [updated.rows[0].id]);
  return mapTask(result.rows[0]);
}

export async function deleteTask(profileId: string, taskId: number): Promise<void> {
  parseProfileId(profileId);
  assertTaskId(taskId);
  const result = await pool.query(`delete from tasks where profile_id = $1 and id = $2`, [profileId, taskId]);
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Tarefa não encontrada.");
}

export interface DailyCompletion {
  date: string;
  total: number;
  completed: number;
}

export async function dailyCompletions(profileId: string, fromDate: string, toDate: string): Promise<DailyCompletion[]> {
  const result = await pool.query<{ due_date: Date | string; total: string; completed: string }>(
    `select due_date,
            count(*)::int as total,
            count(completed_at)::int as completed
     from tasks
     where profile_id = $1 and due_date between $2::date and $3::date
     group by due_date
     order by due_date desc`,
    [profileId, fromDate, toDate],
  );
  return result.rows.map((row) => ({
    date: typeof row.due_date === "string" ? row.due_date : row.due_date.toISOString().slice(0, 10),
    total: Number(row.total),
    completed: Number(row.completed),
  }));
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  todayQualified: boolean;
  todayTotal: number;
  todayStatus?: StreakDayStatus | null;
  yesterdayStatus?: StreakDayStatus | null;
  shieldCount: number;
  equippedShieldIconUrl?: string;
}
/**
 * Regra do streak (fonte única de verdade): um dia conta quando o usuário
 * concluiu pelo menos UMA sessão de foco naquele dia — de QUALQUER duração
 * (até 1 minuto). Check-ins, tarefas, missões e metas NÃO têm efeito.
 *
 * A matemática mora em `reconcileStreak` (src/lib/streak-reconcile.ts). Esta
 * função só: lê os dias reais, chama o recálculo e persiste tudo em UMA
 * transação (shields, protectedDays e campos de streak juntos), de forma
 * idempotente — abrir o app 10 vezes não gasta escudo extra.
 */
export async function computeStreak(profileId: string, today: string): Promise<StreakInfo> {
  parseProfileId(profileId);

  // Dias com pelo menos uma sessão de foco completada (qualquer duração ≥ 1min).
  // `ended_at is not null` marca sessões finalizadas; duração 0 (abandono
  // imediato) não conta. Helpers de outros fluxos (jardim, missões) mantêm
  // seu critério próprio — aqui vale apenas a regra do streak.
  const sessions = await pool.query<{ day: string; n: string | number }>(
    `select to_char((ended_at at time zone $1)::date, 'YYYY-MM-DD') as day, count(*)::int as n
       from focus_sessions
      where profile_id = $2
        and ended_at is not null
        and duration_minutes >= 1
        and (ended_at at time zone $1)::date > ($3::date - interval '400 days')
        and (ended_at at time zone $1)::date <= $3::date
      group by day`,
    [APP_TIMEZONE, profileId, today],
  );
  const sessionsByDay = new Map<string, number>(
    sessions.rows.map((r) => [r.day, Number(r.n)]),
  );
  const todaySessions = sessionsByDay.get(today) ?? 0;
  const baseShields = await getShieldCount(profileId);

  const protectedRes = await pool.query<{ day: string }>(
    `select to_char(used_on_date, 'YYYY-MM-DD') as day
       from streak_shield_usage
      where profile_id = $1
        and used_on_date > ($2::date - interval '400 days')
        and used_on_date <= $2::date`,
    [profileId, today],
  );
  const protectedDays = protectedRes.rows.map((r) => r.day);

  const { currentStreak, bestStreak, shields, newProtectedDays, lostDays, status } =
    reconcileStreak({
      focusDays: [...sessionsByDay.keys()],
      protectedDays,
      shields: baseShields,
      today,
    });

  const focusDays = [...sessionsByDay.keys()];
  const { todayQualified } = calculateStreak(focusDays, today);

  // ─── Persistência em UMA transação ────────────────────────────────────────
  const client = await pool.connect();
  try {
    await client.query("begin");

    // Escudos gastos nos dias recém-protegidos (uma linha por dia, idempotente).
    for (const day of newProtectedDays) {
      const marker = await client.query(
        `insert into streak_shield_usage (profile_id, used_on_date, streak_value_at_use)
         values ($1, $2, $3) on conflict do nothing`,
        [profileId, day, currentStreak],
      );
      if ((marker.rowCount ?? 0) > 0) {
        const updated = await client.query(
          `update profiles set streak_shield_count = streak_shield_count - 1
           where id = $1 and streak_shield_count > 0 returning streak_shield_count`,
          [profileId],
        );
        if ((updated.rowCount ?? 0) === 0) {
          throw new Error("shield mismatch");
        }
      }
    }

    // streak_day_log: escopo = dias com realidade conhecida (foco, protegidos,
    // perdidos) — nunca sobrescrever "protected" com "lost".
    for (const day of focusDays) {
      await client.query(
        `insert into streak_day_log (profile_id, log_date, status)
         values ($1, $2, 'success')
         on conflict (profile_id, log_date) do update set status = 'success'`,
        [profileId, day],
      );
    }
    for (const day of [...protectedDays, ...newProtectedDays]) {
      await client.query(
        `insert into streak_day_log (profile_id, log_date, status)
         values ($1, $2, 'protected')
         on conflict (profile_id, log_date) do update set status = 'protected'`,
        [profileId, day],
      );
    }
    for (const day of lostDays) {
      await client.query(
        `insert into streak_day_log (profile_id, log_date, status)
         values ($1, $2, 'lost')
         on conflict (profile_id, log_date)
         do update set status = case when streak_day_log.status = 'protected' then 'protected' else 'lost' end`,
        [profileId, day],
      );
    }

    // Nunca confiar no número antigo: regravar a partir do histórico real.
    await client.query(
      `update profiles
          set current_streak = $2,
              longest_streak = greatest(coalesce(longest_streak, 0), $3),
              streak_shield_count = $4
        where id = $1`,
      [profileId, currentStreak, bestStreak, shields],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

    // Debug log removed — exposes PII (profileId, streak details).
    // Use structured logger in production if needed.

  // Missão "1 dia de sequência" (idempotente: set, não incrementa).
  await recordMissionProgress(profileId, "STREAK_DAY", { setTo: todayQualified ? 1 : 0, questDate: today });

  // Status dos dias exibidos no popup.
  const yesterday = addDaysIso(today, -1);
  const logRes = await pool.query<{ log_date: string; status: string }>(
    `select to_char(log_date, 'YYYY-MM-DD') as log_date, status
       from streak_day_log
      where profile_id = $1 and log_date in ($2::date, $3::date)`,
    [profileId, yesterday, today],
  );
  const logByDate = new Map(logRes.rows.map((r) => [r.log_date, r.status]));

  // Ícone do escudo equipado.
  let equippedShieldIconUrl: string | undefined;
  try {
    const equippedShieldId = await getEquippedShieldDesignId(profileId);
    if (equippedShieldId) {
      const design = await getStreakShieldDesignById(equippedShieldId);
      if (design) {
        equippedShieldIconUrl = design.iconUrl;
      }
    }
  } catch (error) {
    console.error("[streak] Failed to fetch equipped shield design:", error);
  }

  return {
    currentStreak,
    longestStreak: bestStreak,
    todayQualified,
    todayTotal: todaySessions,
    todayStatus: (logByDate.get(today) as StreakDayStatus | undefined) ?? null,
    yesterdayStatus: (logByDate.get(yesterday) as StreakDayStatus | undefined) ?? null,
    shieldCount: shields,
    equippedShieldIconUrl,
  };
}

/**
 * Historia real por dia para o calendario de sequencia: mapeia cada dia de um
 * mes para o estado correspondente do streak, reutilizando o MESMO predicado de
 * `computeStreak` (sessao de foco qualificada OR dia protegido por escudo).
 * Nao recalcula o streak — so consulta o historico ja existente.
 */
export async function getStreakCalendar(
  profileId: string,
  year: number,
  month: number,
): Promise<Record<string, StreakDayStatus>> {
  parseProfileId(profileId);

  const fromDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const toDateExclusive = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-01`;

  // Dia "vivo" por sessao de foco qualificada (mesmo predicado do streak).
  const sessions = await pool.query<{ day: string }>(
    `select to_char((ended_at at time zone $1)::date, 'YYYY-MM-DD') as day
       from focus_sessions
      where profile_id = $2
        and ended_at is not null
        and duration_minutes >= 1
        and (ended_at at time zone $1)::date >= $3::date
        and (ended_at at time zone $1)::date < $4::date`,
    [APP_TIMEZONE, profileId, fromDate, toDateExclusive],
  );

  const byDate: Record<string, StreakDayStatus> = {};
  for (const row of sessions.rows) byDate[row.day] = "success";

  // Dia protegido por escudo (sobrescreve apenas onde nao houve sessao).
  const protectedRes = await pool.query<{ day: string }>(
    `select to_char(used_on_date, 'YYYY-MM-DD') as day
       from streak_shield_usage
      where profile_id = $1
        and used_on_date >= $2::date
        and used_on_date < $3::date`,
    [profileId, fromDate, toDateExclusive],
  );
  for (const row of protectedRes.rows) {
    if (!byDate[row.day]) byDate[row.day] = "protected";
  }

  return byDate;
}

/**
 * Real-time streak hook, fired by focus.ts right after a session completes with
 * its full target duration reached. On the FIRST qualifying session of the day
 * it re-runs the streak evaluation so the current streak (profile row, day log
 * and the STREAK_DAY mission) updates immediately — the UI reflects it on the
 * next snapshot fetch instead of waiting for the next lazy evaluation.
 */
export async function onFocusSessionCompleted(profileId: string, day: string = todayIso()): Promise<{ previousStreak: number; currentStreak: number } | null> {
  const today = day;
  const prior = await pool.query<{ n: number }>(
    `select count(*)::int as n
       from focus_sessions
      where profile_id = $1
        and ended_at is not null
        and duration_minutes >= 1
        and (ended_at at time zone $2)::date = $3::date`,
    [profileId, APP_TIMEZONE, today],
  );
  // `prior` já inclui a sessão que acabou de completar: n === 1 significa
  // primeira sessão do dia — o momento de reavaliar o streak.
  if ((prior.rows[0]?.n ?? 0) === 1) {
    const before = await pool.query<{ current_streak: number }>(
      `select current_streak from profiles where id = $1`,
      [profileId],
    );
    const previousStreak = before.rows[0]?.current_streak ?? 0;
    const info = await computeStreak(profileId, today);
    return { previousStreak, currentStreak: info.currentStreak };
  }
  return null;
}

async function persistStreak(profileId: string, current: number, longest: number): Promise<void> {
  await pool.query(
    `update profiles
     set current_streak = $2,
         longest_streak = greatest(coalesce(longest_streak, 0), $3)
     where id = $1`,
     [profileId, current, longest],
  );
}

