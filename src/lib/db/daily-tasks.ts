import pool from "../db";
import { ForbiddenError, NotFoundError } from "../errors";
import { parseProfileId, ValidationError } from "./validation";
import { todayIso } from "./dates";
import { recordMissionProgress } from "./daily-quests";
import { addCoins } from "./settings";

import {
  DAILY_TASK_LIMIT,
  DAILY_TASK_XP,
  DAILY_TASK_COINS,
  DAILY_TASK_ALL_BONUS_COINS,
} from "../daily-limits";

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
 * Ensures the user_daily_tasks table supports user-written titles (migration-safe).
 */
export async function ensureDailyTasksSchema(): Promise<void> {
  await pool.query(`alter table user_daily_tasks add column if not exists title text`);
  await pool.query(`alter table user_daily_tasks alter column task_id drop not null`);
  await pool.query(`
    do $$ begin
      alter table xp_ledger drop constraint if exists xp_ledger_source_check;
    exception when undefined_object then null;
    end $$`);
  await pool.query(`
    do $$ begin
      alter table xp_ledger add constraint xp_ledger_source_check
        check (source in ('task','kanban','focus','streak_bonus','daily_quest','daily_task'));
    exception when duplicate_object then null;
    end $$`);
}

/**
 * Removes legacy auto-assigned pool tasks so only user-written tasks remain.
 */
async function purgeLegacyPoolTasks(profileId: string, taskDate: string): Promise<void> {
  await pool.query(
    `delete from user_daily_tasks
     where profile_id = $1 and task_date = $2::date
       and (title is null or title = '')`,
    [profileId, taskDate],
  );
}

export async function listDailyTasks(profileId: string, taskDate: string): Promise<UserDailyTask[]> {
  parseProfileId(profileId);
  await ensureDailyTasksSchema();
  await purgeLegacyPoolTasks(profileId, taskDate);

  const result = await pool.query<Row>(
    `select id, title, task_date, is_completed, completed_at
     from user_daily_tasks
     where profile_id = $1 and task_date = $2::date and title is not null and title <> ''
     order by id`,
    [profileId, taskDate],
  );
  return result.rows.map(mapRow);
}

export async function createDailyTask(
  profileId: string,
  taskDate: string,
  title: string,
): Promise<UserDailyTask> {
  parseProfileId(profileId);
  const trimmed = title.trim();
  if (!trimmed) throw new ValidationError("Digite o nome da tarefa.");
  if (trimmed.length > 120) throw new ValidationError("Tarefa muito longa (máx. 120 caracteres).");

  await ensureDailyTasksSchema();
  await purgeLegacyPoolTasks(profileId, taskDate);

  const existing = await listDailyTasks(profileId, taskDate);
  if (existing.length >= DAILY_TASK_LIMIT) {
    throw new ForbiddenError(`Você pode adicionar no máximo ${DAILY_TASK_LIMIT} tarefas por dia.`);
  }

  const result = await pool.query<Row>(
    `insert into user_daily_tasks (profile_id, title, task_date)
     values ($1, $2, $3::date)
     returning id, title, task_date, is_completed, completed_at`,
    [profileId, trimmed, taskDate],
  );

  return mapRow(result.rows[0]);
}

export async function deleteDailyTask(profileId: string, taskId: number): Promise<void> {
  parseProfileId(profileId);
  const result = await pool.query(
    `delete from user_daily_tasks where id = $1 and profile_id = $2`,
    [taskId, profileId],
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new NotFoundError("Tarefa diária não encontrada.");
  }
}

/**
 * Toggles a user-written daily task. Completing awards XP + coins (once).
 * Completing all tasks for the day grants a small bonus.
 */
export async function toggleDailyTask(
  profileId: string,
  progressId: number,
  completed: boolean,
): Promise<{ task: UserDailyTask; xpAwarded: number; coinsAwarded: number }> {
  parseProfileId(profileId);

  const before = await pool.query<{ profile_id: string; is_completed: boolean; task_date: Date | string }>(
    `select profile_id, is_completed, task_date from user_daily_tasks where id = $1`,
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
     returning id, title, task_date, is_completed, completed_at`,
    [progressId, completed],
  );
  if (!updated.rows[0]) throw new NotFoundError("Tarefa diária não encontrada.");

  const task = mapRow(updated.rows[0]);
  const date = task.taskDate;

  let xpAwarded = 0;
  let coinsAwarded = 0;

  if (completed && !alreadyDone) {
    xpAwarded = DAILY_TASK_XP;
    coinsAwarded = DAILY_TASK_COINS;

    await pool.query(
      `insert into xp_ledger (profile_id, source, source_id, xp_amount)
       values ($1, 'daily_task', $2, $3)`,
      [profileId, progressId, xpAwarded],
    );
    await pool.query(
      `insert into user_xp (profile_id, total_xp, level, updated_at)
       values ($1, $2, 1, now())
       on conflict (profile_id) do update set total_xp = user_xp.total_xp + $2, updated_at = now()`,
      [profileId, xpAwarded],
    );
    await recordMissionProgress(profileId, "XP_EARNED", { incrementBy: xpAwarded, questDate: date });
    await addCoins(profileId, coinsAwarded);

    const allToday = await listDailyTasks(profileId, date);
    const allDone = allToday.length > 0 && allToday.every((t) => t.isCompleted);
    if (allDone) {
      coinsAwarded += DAILY_TASK_ALL_BONUS_COINS;
      await addCoins(profileId, DAILY_TASK_ALL_BONUS_COINS);
    }
  }

  return { task, xpAwarded, coinsAwarded };
}

export { todayIso } from "./dates";
export {
  DAILY_TASK_LIMIT,
  DAILY_TASK_XP,
  DAILY_TASK_COINS,
  DAILY_TASK_ALL_BONUS_COINS,
} from "../daily-limits";
