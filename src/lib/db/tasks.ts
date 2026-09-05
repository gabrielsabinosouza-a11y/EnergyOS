import pool from "../db";
import type { StreakDayStatus, Task } from "@/types";
import { NotFoundError } from "../errors";
import { ValidationError, parseDate, parseProfileId, parseTitle } from "./validation";
import { APP_TIMEZONE, addDaysIso, todayIso } from "./dates";
import { consumeShield, getShieldCount, isDayProtected, logStreakDay, getEquippedShieldDesignId, getStreakShieldDesignById } from "./store";
import { calculateStreak } from "@/lib/streak";
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
 * Regra do streak (binária): um dia conta quando o usuário concluiu pelo menos
 * UMA sessão de foco com a duração-alvo atingida (`ended_at` preenchido e
 * `duration_minutes >= target_duration_minutes`). Check-ins, tarefas, missões e
 * qualquer outra atividade NÃO têm efeito sobre o streak.
 * - Hoje nunca quebra o streak (o dia ainda está em andamento).
 * - Um dia passado sem sessão consome um escudo (fica protegido) ou quebra o
 *   streak no primeiro dia desprotegido.
 */
export async function computeStreak(profileId: string, today: string): Promise<StreakInfo> {
  parseProfileId(profileId);

  // Completed focus sessions grouped by product-timezone day. A session counts
  // only when it reached at least `STREAK_COMPLETION_THRESHOLD` of its target
  // duration (default: 100% of the target) — abandoned sessions never get
  // `ended_at`, and given-up ones end with fewer focused minutes than the
  // target, so both are excluded by the same predicate when the threshold is 1.
  const sessions = await pool.query<{ day: string; n: string | number }>(
    `select to_char((ended_at at time zone $1)::date, 'YYYY-MM-DD') as day, count(*)::int as n
       from focus_sessions
      where profile_id = $2
        and ended_at is not null
        and duration_minutes * 1.0 >= target_duration_minutes * $4
        and (ended_at at time zone $1)::date > ($3::date - interval '400 days')
        and (ended_at at time zone $1)::date <= $3::date
      group by day`,
    [APP_TIMEZONE, profileId, today, STREAK_COMPLETION_THRESHOLD],
  );
  const sessionsByDay = new Map<string, number>(
    sessions.rows.map((r) => [r.day, Number(r.n)]),
  );
  const todaySessions = sessionsByDay.get(today) ?? 0;
  const baseShields = await getShieldCount(profileId);

  // The day-set of qualifying sessions. `calculateStreak` derives the current
  // streak from this real history (source of truth) — a pure, testable function.
  const qualifyingDates = [...sessionsByDay.keys()].sort();
  const { todayQualified } = calculateStreak(qualifyingDates, today);

  // ─── Reconcile the streak-day log and the live streak ─────────────────────
  // A day is ALIVE when it has a qualifying session OR a shield was spent on it
  // (streak_shield_usage). Protected days count as alive and must stay labeled
  // "protected": `consumeShield` returns false for an already-protected day, and
  // a previous version of this walk misread that as "no shield -> lost", which
  // relabeled protected days to "lost" and broke the run on the next read.
  const protectedRes = await pool.query<{ day: string }>(
    `select to_char(used_on_date, 'YYYY-MM-DD') as day
       from streak_shield_usage
      where profile_id = $1
        and used_on_date > ($2::date - interval '400 days')
        and used_on_date <= $2::date`,
    [profileId, today],
  );
  const protectedDates = new Set<string>(protectedRes.rows.map((r) => r.day));
  const isAlive = (date: string): boolean =>
    (sessionsByDay.get(date) ?? 0) > 0 || protectedDates.has(date);

  // Count the contiguous alive tail. Today, when not yet qualified, is open and
  // never counts as a break — the run simply starts from yesterday instead.
  let streak = 0;
  let cursor = addDaysIso(today, -1);
  if (isAlive(today)) streak += 1;
  while (streak < 400 && isAlive(cursor)) {
    if (protectedDates.has(cursor)) {
      // Repair a protected day a previous buggy evaluation relabeled "lost".
      await logStreakDay(profileId, cursor, "protected");
    }
    streak += 1;
    cursor = addDaysIso(cursor, -1);
  }

  // Mark every qualifying day in the window as success (idempotent).
  for (const date of qualifyingDates) {
    await logStreakDay(profileId, date, "success");
  }

  // Extend the run across missed days using shields, but ONLY when the whole
  // region of consecutive missed days can be bridged by the shields still
  // available AND it anchors on an alive day behind it. That keeps shields from
  // being spent at the start of the run (a missed day before the first real
  // session) or across a huge inactivity gap — a shield saves "one missed day",
  // it does not resurrect a month-old run.
  const shieldBudget = baseShields;
  const windowFloor = addDaysIso(today, -400);
  let shieldsUsed = 0;
  while (streak < 400) {
    if (isAlive(cursor)) {
      if (protectedDates.has(cursor)) {
        await logStreakDay(profileId, cursor, "protected");
      }
      streak += 1;
      cursor = addDaysIso(cursor, -1);
      continue;
    }

    // All shields spent already -> nothing left to bridge.
    if (shieldsUsed >= shieldBudget) break;

    // Walk the contiguous region of missed days to find the next alive anchor.
    let regionLen = 0;
    let probe = cursor;
    while (probe > windowFloor && !isAlive(probe)) {
      regionLen += 1;
      probe = addDaysIso(probe, -1);
    }

    // No alive anchor anywhere behind, or the missed region is wider than the
    // shields we can spend → the run ends here.
    if (probe <= windowFloor || regionLen > shieldBudget - shieldsUsed) {
      await logStreakDay(profileId, cursor, "lost");
      console.log(`[streak] ${profileId} day ${cursor} missed without shield -> current streak ${streak}`);
      break;
    }

    // Bridge the whole region (regionLen <= remaining shields), anchoring on
    // the alive day found at `probe`.
    let aborted = false;
    for (let i = 0; i < regionLen; i += 1) {
      const missedDay = addDaysIso(cursor, i);
      const protectedNow = await consumeShield(profileId, missedDay, streak + 1 + i);
      if (protectedNow) {
        protectedDates.add(missedDay);
        shieldsUsed += 1;
      } else if (await isDayProtected(profileId, missedDay)) {
        // A concurrent evaluation may have just protected this exact day.
        protectedDates.add(missedDay);
      } else {
        await logStreakDay(profileId, missedDay, "lost");
        console.log(`[streak] ${profileId} day ${missedDay} missed without shield -> current streak ${streak}`);
        aborted = true;
        break;
      }
      streak += 1;
      console.log(`[streak] ${profileId} missed ${missedDay} but protected by shield (shield #${shieldsUsed})`);
    }
    if (aborted) break;
    cursor = probe;
  }

  // Longest consecutive qualifying run across the whole window (ignores shield
  // protection).
  let longest = 0;
  let run = 0;
  let prevDate: string | null = null;
  for (const date of qualifyingDates) {
    run = prevDate !== null && addDaysIso(prevDate, 1) === date ? run + 1 : 1;
    if (run > longest) longest = run;
    prevDate = date;
  }

  await persistStreak(profileId, streak, longest);

  // Record the "keep your streak alive one more day" mission (idempotent: it
  // sets today's value to 1 or 0 rather than incrementing, so repeated reads
  // never over-count).
  await recordMissionProgress(profileId, "STREAK_DAY", { setTo: todayQualified ? 1 : 0, questDate: today });

  // Pull latest streak-day log statuses so the UI can render saved/protected/lost states.
  const yesterday = addDaysIso(today, -1);
  const logRes = await pool.query<{ log_date: string; status: string }>(
    `select to_char(log_date, 'YYYY-MM-DD') as log_date, status
      from streak_day_log
      where profile_id = $1 and log_date in ($2::date, $3::date)`,
    [profileId, yesterday, today],
  );
  const logByDate = new Map(logRes.rows.map((r) => [r.log_date, r.status]));

  console.log(`[streak] ${profileId} result -> current=${streak}, longest=${longest}, shieldsUsed=${shieldsUsed}, shieldsLeft=${baseShields - shieldsUsed}`);

  // Get equipped shield design icon URL
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
    console.log(`[streak] Could not fetch equipped shield design for ${profileId}:`, error);
  }

  return {
    currentStreak: streak,
    longestStreak: longest,
    todayQualified,
    todayTotal: todaySessions,
    todayStatus: (logByDate.get(today) as StreakDayStatus | undefined) ?? null,
    yesterdayStatus: (logByDate.get(yesterday) as StreakDayStatus | undefined) ?? null,
    shieldCount: baseShields - shieldsUsed,
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
        and duration_minutes * 1.0 >= target_duration_minutes * $4
        and (ended_at at time zone $1)::date >= $3::date
        and (ended_at at time zone $1)::date < $5::date`,
    [APP_TIMEZONE, profileId, fromDate, STREAK_COMPLETION_THRESHOLD, toDateExclusive],
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
export async function onFocusSessionCompleted(profileId: string): Promise<void> {
  const today = todayIso();
  const prior = await pool.query<{ n: number }>(
    `select count(*)::int as n
       from focus_sessions
      where profile_id = $1
        and ended_at is not null
        and duration_minutes * 1.0 >= target_duration_minutes * $4
        and (ended_at at time zone $2)::date = $3::date`,
    [profileId, APP_TIMEZONE, today, STREAK_COMPLETION_THRESHOLD],
  );
  // `prior` already includes the session that just completed: n === 1 means
  // this is the first qualifying session of the day, so the streak may move now.
  if ((prior.rows[0]?.n ?? 0) === 1) {
    await computeStreak(profileId, today);
  }
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

