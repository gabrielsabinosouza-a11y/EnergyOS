import pool from "../db";
import { ForbiddenError, NotFoundError } from "../errors";
import { parseProfileId, ValidationError } from "./validation";
import { todayIso } from "./dates";
import { recordMissionProgress } from "./daily-quests";
import { addCoins } from "./settings";
import { creditXP } from "./xp";

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

interface TemplateRow {
  id: string | number;
  title: string;
}

interface LogRow {
  task_id: string | number;
  log_date: Date | string;
  is_completed: boolean;
  completed_at: Date | string | null;
}

interface ListDailyRow {
  "t.id": string | number;
  "t.title": string;
  "l.log_date": Date | string | null;
  "l.is_completed": boolean | null;
  "l.completed_at": Date | string | null;
}

/**
 * Ensures the recurring daily task tables exist.
 */
export async function ensureDailyTasksSchema(): Promise<void> {
  await pool.query(`
    create table if not exists profile_daily_tasks (
      id bigserial primary key,
      profile_id text not null references profiles(id) on delete cascade,
      title text not null,
      is_active boolean not null default true,
      sort_order integer not null default 0,
      created_at timestamptz not null default now()
    )
  `);
  await pool.query(
    `alter table profile_daily_tasks add column if not exists is_active boolean not null default true`,
  );
  await pool.query(
    `create index if not exists profile_daily_tasks_profile_idx on profile_daily_tasks(profile_id, sort_order, id)`,
  );
  await pool.query(`
    create table if not exists daily_task_log (
      task_id bigint not null references profile_daily_tasks(id) on delete cascade,
      log_date date not null,
      is_completed boolean not null default false,
      completed_at timestamptz,
      primary key (task_id, log_date)
    )
  `);
  await pool.query(`
    do $$ begin
      alter table xp_ledger drop constraint if exists xp_ledger_source_check;
    exception when undefined_object then null;
    end $$`);
  await pool.query(`
    do $$ begin
      alter table xp_ledger add constraint xp_ledger_source_check
        check (source in ('task','kanban','kanban_task','focus','streak_bonus','daily_quest','daily_task','checkin','checkin_streak','goal','achievement'));
    exception when duplicate_object then null;
    end $$`);
}

/**
 * Lists the user's recurring daily tasks with their completion status for the
 * given day. Tasks repeat every day — only the per-day completion changes.
 */
export async function listDailyTasks(profileId: string, taskDate: string): Promise<UserDailyTask[]> {
  parseProfileId(profileId);
  await ensureDailyTasksSchema();

  const result = await pool.query<ListDailyRow>(
    `select
        t.id as "t.id", t.title as "t.title",
        l.log_date as "l.log_date", l.is_completed as "l.is_completed", l.completed_at as "l.completed_at"
     from profile_daily_tasks t
     left join daily_task_log l
       on l.task_id = t.id and l.log_date = $2::date
     where t.profile_id = $1 and t.is_active = true
     order by t.sort_order, t.id`,
    [profileId, taskDate],
  );

  return result.rows.map((r) => ({
    id: Number(r["t.id"]),
    title: r["t.title"],
    taskDate,
    isCompleted: Boolean(r["l.is_completed"]),
    completedAt: r["l.completed_at"] ? new Date(r["l.completed_at"] as string).toISOString() : undefined,
  }));
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

  const count = await pool.query<{ n: string | number }>(
    `select count(*)::int as n from profile_daily_tasks where profile_id = $1 and is_active = true`,
    [profileId],
  );
  if (Number(count.rows[0]?.n ?? 0) >= DAILY_TASK_LIMIT) {
    throw new ForbiddenError(`Você pode adicionar no máximo ${DAILY_TASK_LIMIT} tarefas diárias.`);
  }

  const result = await pool.query<TemplateRow>(
    `insert into profile_daily_tasks (profile_id, title, sort_order)
     values ($1, $2, (select coalesce(max(sort_order), 0) + 1 from profile_daily_tasks where profile_id = $1))
     returning id, title`,
    [profileId, trimmed],
  );

  return {
    id: Number(result.rows[0].id),
    title: result.rows[0].title,
    taskDate,
    isCompleted: false,
  };
}

/**
 * Soft-archives a recurring daily task: the task row (and its completion
 * history) is kept with is_active = false — it just stops appearing in the
 * daily checklist. Use create/toggle to bring structure back if ever needed.
 */
export async function deactivateDailyTask(profileId: string, taskId: number): Promise<void> {
  parseProfileId(profileId);
  const result = await pool.query(
    `update profile_daily_tasks set is_active = false where id = $1 and profile_id = $2`,
    [taskId, profileId],
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new NotFoundError("Tarefa diária não encontrada.");
  }
}

/**
 * Toggles a recurring daily task for a given day. Completing awards XP + coins
 * (once) and advances the XP-EARNED and TASKS-COMPLETED missions. Completing
 * all tasks for the day grants a small bonus.
 */
export async function toggleDailyTask(
  profileId: string,
  taskId: number,
  completed: boolean,
  taskDate?: string,
): Promise<{ task: UserDailyTask; xpAwarded: number; coinsAwarded: number }> {
  parseProfileId(profileId);
  const date = taskDate ?? todayIso();

  const t = await pool.query<TemplateRow>(
    `select id, title from profile_daily_tasks where id = $1 and profile_id = $2`,
    [taskId, profileId],
  );
  if (!t.rows[0]) {
    throw new NotFoundError("Tarefa diária não encontrada.");
  }

  const existing = await pool.query<LogRow>(
    `select task_id, log_date, is_completed, completed_at from daily_task_log where task_id = $1 and log_date = $2::date`,
    [taskId, date],
  );

  const alreadyDone = Boolean(existing.rows[0]?.is_completed);

  if (completed && !alreadyDone) {
    await pool.query(
      `insert into daily_task_log (task_id, log_date, is_completed, completed_at)
       values ($1, $2::date, true, now())
       on conflict (task_id, log_date) do update set is_completed = true, completed_at = now()`,
      [taskId, date],
    );
  } else if (!completed && alreadyDone) {
    await pool.query(
      `update daily_task_log set is_completed = false, completed_at = null where task_id = $1 and log_date = $2::date`,
      [taskId, date],
    );
  }

  let xpAwarded = 0;
  let coinsAwarded = 0;

  if (completed && !alreadyDone) {
    xpAwarded = DAILY_TASK_XP;
    coinsAwarded = DAILY_TASK_COINS;

    await creditXP(profileId, "daily_task", taskId, xpAwarded, { questDate: date });
    await recordMissionProgress(profileId, "TASKS_COMPLETED", { incrementBy: 1, questDate: date });
    await addCoins(profileId, coinsAwarded);

    const allToday = await listDailyTasks(profileId, date);
    const allDone = allToday.length > 0 && allToday.every((t2) => t2.isCompleted);
    if (allDone) {
      coinsAwarded += DAILY_TASK_ALL_BONUS_COINS;
      await addCoins(profileId, DAILY_TASK_ALL_BONUS_COINS);
    }
  }

  const task: UserDailyTask = {
    id: taskId,
    title: t.rows[0].title,
    taskDate: date,
    isCompleted: completed,
    completedAt: completed && !alreadyDone ? new Date().toISOString() : completed ? (existing.rows[0]?.completed_at ? new Date(existing.rows[0].completed_at).toISOString() : undefined) : undefined,
  };

  return { task, xpAwarded, coinsAwarded };
}

export { todayIso } from "./dates";
export {
  DAILY_TASK_LIMIT,
  DAILY_TASK_XP,
  DAILY_TASK_COINS,
  DAILY_TASK_ALL_BONUS_COINS,
} from "../daily-limits";
