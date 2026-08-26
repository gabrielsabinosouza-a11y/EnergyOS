import pool from "../db";
import type { Task, TaskCategory } from "@/types";
import { NotFoundError } from "../errors";
import { ValidationError, parseDate, parseEnum, parseProfileId, parseTitle } from "./validation";
import { consumeShield, getShieldCount, logStreakDay } from "./store";

const TASK_CATEGORIES: readonly TaskCategory[] = ["FOCO", "CORPO", "MENTE", "ORDEM", "ENERGIA"];

function assertTaskId(taskId: number): void {
  if (!Number.isInteger(taskId) || taskId <= 0) throw new ValidationError("Tarefa inválida.");
}

interface TaskRow {
  id: string | number;
  profile_id: string;
  title: string;
  category: TaskCategory;
  due_date: Date | string;
  completed_at: Date | string | null;
}

function mapTask(row: TaskRow): Task {
  return {
    id: Number(row.id),
    profileId: row.profile_id,
    title: row.title,
    category: row.category,
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
    `select id, profile_id, title, category, due_date, completed_at
     from tasks
     where profile_id = $1 and due_date = $2::date
     order by completed_at asc nulls last, id asc`,
    [profileId, date],
  );
  return result.rows.map(mapTask);
}

export async function createTask(
  profileId: string,
  input: { title: string; category: TaskCategory; dueDate?: string },
  today: string,
): Promise<Task> {
  parseProfileId(profileId);
  const title = parseTitle(input.title);
  const category = parseEnum(input.category, TASK_CATEGORIES, "Categoria");
  const dueDate = parseDate(input.dueDate, "Data da tarefa", today);
  const result = await pool.query<TaskRow>(
    `insert into tasks (profile_id, title, category, due_date)
     values ($1, $2, $3, $4::date)
     returning id, profile_id, title, category, due_date, completed_at`,
    [profileId, title, category, dueDate],
  );
  return mapTask(result.rows[0]);
}

export interface UpdateTaskPatch {
  title?: string;
  category?: TaskCategory;
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
  if (patch.category !== undefined) {
    values.push(parseEnum(patch.category, TASK_CATEGORIES, "Categoria"));
    updates.push(`category = $${values.length}`);
  }
  if (patch.dueDate !== undefined) {
    values.push(parseDate(patch.dueDate, "Data da tarefa"));
    updates.push(`due_date = $${values.length}::date`);
  }
  if (updates.length === 0) throw new ValidationError("Nenhum campo para atualizar.");

  const result = await pool.query<TaskRow>(
    `update tasks set ${updates.join(", ")}
     where profile_id = $1 and id = $2
     returning id, profile_id, title, category, due_date, completed_at`,
    values,
  );
  if (!result.rows[0]) throw new NotFoundError("Tarefa não encontrada.");
  return mapTask(result.rows[0]);
}

export async function setTaskCompleted(profileId: string, taskId: number, completed: boolean): Promise<Task> {
  parseProfileId(profileId);
  assertTaskId(taskId);
  const result = await pool.query<TaskRow>(
    `update tasks set completed_at = case when $3 then now() else null end
     where profile_id = $1 and id = $2
     returning id, profile_id, title, category, due_date, completed_at`,
    [profileId, taskId, completed],
  );
  if (!result.rows[0]) throw new NotFoundError("Tarefa não encontrada.");
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
}

/**
 * Regra do streak: dia conta quando >= 50% das tarefas daquele dia foram concluídas.
 * - Dias sem tarefas são ignorados (não contam nem quebram o streak).
 * - Hoje só quebra o streak se já tiver tarefas e menos de 50% concluídas.
 */
export async function computeStreak(profileId: string, today: string): Promise<StreakInfo> {
  parseProfileId(profileId);
  const days = await dailyCompletions(profileId, addDays(today, -365), today);
  if (days.length === 0) {
    await persistStreak(profileId, 0, 0);
    return { currentStreak: 0, longestStreak: 0, todayQualified: false, todayTotal: 0 };
  }

  let streak = 0;
  let shieldsUsed = 0;
  const maxShields = await getShieldCount(profileId);

  for (const day of days) {
    const qualifies = day.total > 0 && day.completed / day.total >= 0.5;
    if (!qualifies) {
      if (day.date === today && streak === 0) continue;
      // Try to protect this day with a shield (only for past days, not today)
      if (day.date !== today && shieldsUsed < maxShields) {
        shieldsUsed += 1;
        streak += 1;
        continue;
      }
      break;
    }
    streak += 1;
  }

  // Log streak days
  for (const day of days) {
    if (day.date > today) continue;
    const qualifies = day.total > 0 && day.completed / day.total >= 0.5;
    if (qualifies) {
      await logStreakDay(profileId, day.date, "success");
    }
  }

  // Consume shields for protected days
  if (shieldsUsed > 0) {
    for (let i = 0; i < shieldsUsed; i++) {
      await consumeShield(profileId, streak);
    }
  }

  const chronological = [...days].reverse();
  let run = 0;
  let longest = 0;
  for (const day of chronological) {
    const qualifies = day.total > 0 && day.completed / day.total >= 0.5;
    if (qualifies) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }

  const todayEntry = days.find((day) => day.date === today);
  await persistStreak(profileId, streak, longest);
  return {
    currentStreak: streak,
    longestStreak: longest,
    todayQualified: Boolean(todayEntry && todayEntry.completed / todayEntry.total >= 0.5),
    todayTotal: todayEntry?.total ?? 0,
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
