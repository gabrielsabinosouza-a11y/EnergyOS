import pool from "../db";
import type { StreakDayStatus, Task } from "@/types";
import { NotFoundError } from "../errors";
import { ValidationError, parseDate, parseProfileId, parseTitle } from "./validation";
import { consumeShield, getShieldCount, logStreakDay } from "./store";
import { assertCategoryForProfile, resolveDefaultCategoryId } from "./categories";

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
}

/**
 * Regra do streak: dia conta quando >= 50% das tarefas daquele dia foram concluídas.
 * - Dias sem tarefas são ignorados (não contam nem quebram o streak).
 * - Hoje só quebra o streak se já tiver tarefas e menos de 50% concluídas.
 */
export async function computeStreak(profileId: string, today: string): Promise<StreakInfo> {
  parseProfileId(profileId);
  const days = await dailyCompletions(profileId, addDays(today, -365), today);
  let baseShields = await getShieldCount(profileId);

  // oldest -> newest, so each day's outcome is evaluated and persisted once in order.
  const chronological = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (chronological.length === 0) {
    await persistStreak(profileId, 0, 0);
    console.log(`[streak] ${profileId} no qualifying activity window -> current=0, shields=${baseShields}`);
    return {
      currentStreak: 0,
      longestStreak: 0,
      todayQualified: false,
      todayTotal: 0,
      todayStatus: null,
      yesterdayStatus: null,
      shieldCount: baseShields,
    };
  }

  // Current streak: consecutive qualifying (or shield-protected) days ending "now".
  let streak = 0;
  let shieldsUsed = 0;

  // Longest qualifying run across the whole window (ignores shield protection).
  let run = 0;
  let longest = 0;

  for (const day of chronological) {
    if (day.date > today) continue;
    const qualifies = day.total > 0 && day.completed / day.total >= 0.5;
    const isToday = day.date === today;

    // Longest run (qualifying days only, no shields).
    if (qualifies) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }

    if (qualifies) {
      streak += 1;
      await logStreakDay(profileId, day.date, "success");
      continue;
    }

    // Non-qualifying day.
    if (isToday) {
      // Today in progress: ignore for streak (never breaks, never consumes a shield).
      continue;
    }

    // A fully-missed past day: attempt protection with a shield.
    const protectedNow = await consumeShield(profileId, day.date, streak + 1);
    if (protectedNow) {
      shieldsUsed += 1;
      streak += 1;
      console.log(`[streak] ${profileId} missed ${day.date} but protected by shield (shield #${shieldsUsed})`);
      continue;
    }

    // No shield available/protection already consumed for prior days -> streak breaks.
    await logStreakDay(profileId, day.date, "lost");
    console.log(`[streak] ${profileId} day ${day.date} missed without shield -> current streak reset to ${streak}`);
    break;
  }

  const todayEntry = chronological.find((day) => day.date === today);
  await persistStreak(profileId, streak, longest);

  // Pull latest streak-day log statuses so the UI can render saved/protected/lost states.
  const yesterday = addDays(today, -1);
  const logRes = await pool.query<{ log_date: string; status: string }>(
    `select log_date, status
     from streak_day_log
     where profile_id = $1 and log_date in ($2, $3)`,
    [profileId, yesterday, today],
  );
  const logByDate = new Map(logRes.rows.map((r) => [r.log_date, r.status]));

  console.log(`[streak] ${profileId} result -> current=${streak}, longest=${longest}, shieldsUsed=${shieldsUsed}, shieldsLeft=${baseShields - shieldsUsed}`);

  return {
    currentStreak: streak,
    longestStreak: longest,
    todayQualified: Boolean(todayEntry && todayEntry.completed / todayEntry.total >= 0.5),
    todayTotal: todayEntry?.total ?? 0,
    todayStatus: (logByDate.get(today) as StreakDayStatus | undefined) ?? null,
    yesterdayStatus: (logByDate.get(yesterday) as StreakDayStatus | undefined) ?? null,
    shieldCount: baseShields - shieldsUsed,
  };
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

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
