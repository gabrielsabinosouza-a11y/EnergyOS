import pool from "../db";
import { NotFoundError } from "../errors";
import { parseProfileId } from "./validation";
import { addDaysIso, todayIso } from "./dates";
import { recordMissionProgress } from "./daily-quests";

// Exact number of daily tasks assigned to each user per day.
export const DAILY_TASK_LIMIT = 3;

// XP awarded when the user checks off one daily task.
export const DAILY_TASK_XP = 10;

export interface UserDailyTask {
  id: number;
  title: string;
  taskDate: string;
  isCompleted: boolean;
  completedAt?: string;
}

interface Row {
  id: string | number;
  title: string;
  task_date: Date | string;
  is_completed: boolean;
  completed_at: Date | string | null;
}

function mapRow(row: Row): UserDailyTask {
  return {
    id: Number(row.id),
    title: row.title,
    taskDate: typeof row.task_date === "string" ? row.task_date : row.task_date.toISOString().slice(0, 10),
    isCompleted: row.is_completed,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
  };
}

/**
 * Ensures the daily-task pool is seeded (falls back if the SQL seed was not run).
 */
export async function ensureDailyTaskPool(): Promise<void> {
  const existing = await pool.query<{ count: string }>(
    `select count(*)::int as count from daily_task_pool where is_active = true`,
  );
  if (Number(existing.rows[0]?.count || 0) === 0) {
    const titles = [
      "Beber 2L de água", "Ler 20 minutos", "Fazer 10 minutos de alongamento",
      "Meditar 5 minutos", "Organizar sua mesa", "Anotar 3 ideias",
      "Responder e-mails pendentes", "Revisar metas da semana", "Caminhar 30 minutos",
      "Planejar o dia de amanhã", "Estudar 45 minutos", "Treinar 30 minutos",
      "Refletir e agradecer", "Desconectar 1h das telas", "Ligar para um amigo ou parente",
      "Fazer uma refeição saudável", "Escrever 200 palavras", "Organizar o ambiente digital",
      "Beber água a cada hora", "Dormir cedo esta noite",
    ];
    for (let i = 0; i < titles.length; i++) {
      await pool.query(
        `insert into daily_task_pool (title, sort_order) values ($1, $2) on conflict (title) do nothing`,
        [titles[i], i + 1],
      );
    }
  }
}

function shuffle<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function listDailyTasks(profileId: string, taskDate: string): Promise<UserDailyTask[]> {
  parseProfileId(profileId);
  const result = await pool.query<Row>(
    `select udt.id, t.title, udt.task_date, udt.is_completed, udt.completed_at
     from user_daily_tasks udt
     join daily_task_pool t on t.id = udt.task_id
     where udt.profile_id = $1 and udt.task_date = $2::date
     order by udt.id`,
    [profileId, taskDate],
  );
  return result.rows.map(mapRow);
}

/**
 * Assigns exactly DAILY_TASK_LIMIT (3) random tasks to the user for the date,
 * preferring to avoid repeating yesterday's exact set when enough tasks exist.
 */
export async function ensureUserDailyTasks(profileId: string, taskDate: string): Promise<UserDailyTask[]> {
  parseProfileId(profileId);
  await ensureDailyTaskPool();

  const poolArr = await pool.query<{ id: string | number }>(
    `select id from daily_task_pool where is_active = true order by id`,
  );
  const ids = poolArr.rows.map((r) => Number(r.id));

  const existing = await listDailyTasks(profileId, taskDate);
  if (existing.length >= DAILY_TASK_LIMIT) {
    return existing;
  }

  const existingIds = new Set(existing.map((t) => t.id));
  const yesterday = addDaysIso(taskDate, -1);
  const yesterdayRows = await listDailyTasks(profileId, yesterday);
  const yesterdayIds = new Set(yesterdayRows.map((t) => t.id));

  const notAssigned = ids.filter((id) => !existingIds.has(id));
  const fresh = notAssigned.filter((id) => !yesterdayIds.has(id));
  const pickPool = fresh.length >= DAILY_TASK_LIMIT ? fresh : notAssigned;

  const need = DAILY_TASK_LIMIT - existing.length;
  const pick = shuffle(pickPool).slice(0, need);

  for (const taskId of pick) {
    await pool.query(
      `insert into user_daily_tasks (profile_id, task_id, task_date) values ($1, $2, $3::date)
       on conflict (profile_id, task_id, task_date) do nothing`,
      [profileId, taskId, taskDate],
    );
  }

  return listDailyTasks(profileId, taskDate);
}

/**
 * Toggles a daily task's completion. Completing a task awards DAILY_TASK_XP
 * (once) and feeds the XP mission. Completing all 3 marks the day's set done.
 */
export async function toggleDailyTask(
  profileId: string,
  progressId: number,
  completed: boolean,
): Promise<{ task: UserDailyTask; xpAwarded: number }> {
  parseProfileId(profileId);

  const before = await pool.query<{ profile_id: string; is_completed: boolean }>(
    `select profile_id, is_completed from user_daily_tasks where id = $1`,
    [progressId],
  );
  if (!before.rows[0] || before.rows[0].profile_id !== profileId) {
    throw new NotFoundError("Tarefa diária não encontrada.");
  }

  const alreadyDone = before.rows[0].is_completed;
  const updated = await pool.query<Row>(
    `update user_daily_tasks
     set is_completed = $2, completed_at = case when $2 then now() else null end
     where id = $1
     returning id, task_date, is_completed, completed_at`,
    [progressId, completed],
  );
  if (!updated.rows[0]) throw new NotFoundError("Tarefa diária não encontrada.");

  const taskRow = await pool.query<Row>(
    `select udt.id, t.title, udt.task_date, udt.is_completed, udt.completed_at
     from user_daily_tasks udt join daily_task_pool t on t.id = udt.task_id
     where udt.id = $1`,
    [progressId],
  );
  const task = mapRow(taskRow.rows[0]);

  let xpAwarded = 0;
  // Grant XP only on the transition from not-done -> done.
  if (completed && !alreadyDone) {
    xpAwarded = DAILY_TASK_XP;
    const date = task.taskDate;
    await pool.query(
      `insert into xp_ledger (profile_id, source, source_id, xp_amount)
       values ($1, 'daily_task', $2, $3)`,
      [profileId, progressId, xpAwarded],
    );
    await pool.query(
      `insert into user_xp (profile_id, total_xp, level, updated_at)
       values ($1, $3, 1, now())
       on conflict (profile_id) do update set total_xp = user_xp.total_xp + $3, updated_at = now()`,
      [profileId, xpAwarded],
    );
    await recordMissionProgress(profileId, "XP_EARNED", { incrementBy: xpAwarded, questDate: date });
  }

  return { task, xpAwarded };
}

export { todayIso };
