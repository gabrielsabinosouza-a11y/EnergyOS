import pool from "../db";
import { ForbiddenError, NotFoundError } from "../errors";
import { parseDate, parseProfileId, ValidationError } from "./validation";
import { todayIso } from "./dates";
import { recordMissionProgress } from "./daily-quests";
import { addCoins } from "./settings";
import { creditXP } from "./xp";

import {
  HABIT_LIMIT,
  HABIT_XP,
  HABIT_COINS,
  HABIT_ALL_BONUS_COINS,
} from "../daily-limits";

export type HabitIconType = "asset" | "emoji" | "image";
export type HabitFrequencyType = "daily" | "weekdays" | "times_per_week";
export type HabitGoalType = "check" | "measurable";

export interface UserDailyTask {
  id: number;
  title: string;
  taskDate: string;
  isCompleted: boolean;
  completedAt?: string;
  iconType: HabitIconType;
  iconValue: string;
  color: string;
  frequencyType: HabitFrequencyType;
  frequencyDays: number[] | null;
  frequencyTarget: number | null;
  goalType: HabitGoalType;
  targetValue: number | null;
  unit: string | null;
  currentProgress: number;
  description: string | null;
  category: string | null;
  startDate: string | null;
  reminderTime: string | null;
  archived: boolean;
  sortOrder: number;
}

/** Default values for new habit fields when reading old rows. */
const DEFAULT_HABIT_FIELDS = {
  iconType: "asset" as HabitIconType,
  iconValue: "target",
  color: "#71d4ff",
  frequencyType: "daily" as HabitFrequencyType,
  frequencyDays: null,
  frequencyTarget: null,
  goalType: "check" as HabitGoalType,
  targetValue: null,
  unit: null,
  currentProgress: 0,
  description: null,
  category: null,
  startDate: null,
  reminderTime: null,
  archived: false,
  sortOrder: 0,
};

export interface DailyTaskHistoryEntry {
  taskId: number;
  date: string;
  completedAt: string;
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
  "t.icon_type": string;
  "t.icon_value": string;
  "t.color": string;
  "t.frequency_type": string;
  "t.frequency_days": unknown;
  "t.frequency_target": string | number | null;
  "t.goal_type": string;
  "t.target_value": string | number | null;
  "t.unit": string | null;
  "t.current_progress": string | number;
  "t.description": string | null;
  "t.category": string | null;
  "t.start_date": string | null;
  "t.reminder_time": string | null;
  "t.archived": boolean;
  "t.sort_order": string | number;
  "l.log_date": Date | string | null;
  "l.is_completed": boolean | null;
  "l.completed_at": Date | string | null;
}

/** Check if a habit is scheduled for a given day (0=Sun, 1=Mon, ... 6=Sat). */
function isHabitScheduledToday(frequencyType: HabitFrequencyType, frequencyDays: number[] | null, frequencyTarget: number | null, dayOfWeek: number): boolean {
  if (frequencyType === "daily") return true;
  if (frequencyType === "weekdays" && frequencyDays) {
    return frequencyDays.includes(dayOfWeek);
  }
  // times_per_week: treat as daily for now (simplified; full logic tracks weekly count)
  return true;
}

/** Map a row to a UserDailyTask, applying defaults for missing fields. */
function rowToTask(r: ListDailyRow, taskDate: string): UserDailyTask {
  return {
    id: Number(r["t.id"]),
    title: r["t.title"],
    taskDate,
    isCompleted: Boolean(r["l.is_completed"]),
    completedAt: r["l.completed_at"] ? new Date(r["l.completed_at"] as string).toISOString() : undefined,
    iconType: (r["t.icon_type"] as HabitIconType) || DEFAULT_HABIT_FIELDS.iconType,
    iconValue: r["t.icon_value"] || DEFAULT_HABIT_FIELDS.iconValue,
    color: r["t.color"] || DEFAULT_HABIT_FIELDS.color,
    frequencyType: (r["t.frequency_type"] as HabitFrequencyType) || DEFAULT_HABIT_FIELDS.frequencyType,
    frequencyDays: r["t.frequency_days"] ? (Array.isArray(r["t.frequency_days"]) ? r["t.frequency_days"] : JSON.parse(r["t.frequency_days"] as string)) : null,
    frequencyTarget: r["t.frequency_target"] ? Number(r["t.frequency_target"]) : null,
    goalType: (r["t.goal_type"] as HabitGoalType) || DEFAULT_HABIT_FIELDS.goalType,
    targetValue: r["t.target_value"] ? Number(r["t.target_value"]) : null,
    unit: r["t.unit"],
    currentProgress: Number(r["t.current_progress"] ?? 0),
    description: r["t.description"],
    category: r["t.category"],
    startDate: r["t.start_date"],
    reminderTime: r["t.reminder_time"],
    archived: Boolean(r["t.archived"]),
    sortOrder: Number(r["t.sort_order"] ?? 0),
  };
}

/**
 * Ensures the recurring daily task tables exist, adding new habit columns.
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

  // ── New habit columns ──
  await pool.query(`alter table profile_daily_tasks add column if not exists icon_type text not null default 'asset'`);
  await pool.query(`alter table profile_daily_tasks add column if not exists icon_value text not null default 'target'`);
  await pool.query(`alter table profile_daily_tasks add column if not exists color text not null default '#71d4ff'`);
  await pool.query(`alter table profile_daily_tasks add column if not exists frequency_type text not null default 'daily'`);
  await pool.query(`alter table profile_daily_tasks add column if not exists frequency_days int[]`);
  await pool.query(`alter table profile_daily_tasks add column if not exists frequency_target integer`);
  await pool.query(`alter table profile_daily_tasks add column if not exists goal_type text not null default 'check'`);
  await pool.query(`alter table profile_daily_tasks add column if not exists target_value numeric`);
  await pool.query(`alter table profile_daily_tasks add column if not exists unit text`);
  await pool.query(`alter table profile_daily_tasks add column if not exists current_progress numeric not null default 0`);
  await pool.query(`alter table profile_daily_tasks add column if not exists description text`);
  await pool.query(`alter table profile_daily_tasks add column if not exists category text`);
  await pool.query(`alter table profile_daily_tasks add column if not exists start_date date`);
  await pool.query(`alter table profile_daily_tasks add column if not exists reminder_time time`);
  await pool.query(`alter table profile_daily_tasks add column if not exists archived boolean not null default false`);

  // ── daily_task_log progress column ──
  await pool.query(`alter table daily_task_log add column if not exists progress_value numeric`);

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
 * Lists the user's habits scheduled for a given day, with completion status.
 * Filters by frequency so habits not scheduled for today are excluded.
 */
export async function listDailyTasks(profileId: string, taskDate: string): Promise<UserDailyTask[]> {
  parseProfileId(profileId);
  await ensureDailyTasksSchema();

  // Get day of week (0=Sun, 1=Mon, ... 6=Sat) for frequency filtering
  const date = new Date(taskDate + "T12:00:00Z");
  const dayOfWeek = date.getUTCDay();

  const result = await pool.query<ListDailyRow>(
    `select
        t.id as "t.id", t.title as "t.title",
        t.icon_type as "t.icon_type", t.icon_value as "t.icon_value", t.color as "t.color",
        t.frequency_type as "t.frequency_type", t.frequency_days as "t.frequency_days", t.frequency_target as "t.frequency_target",
        t.goal_type as "t.goal_type", t.target_value as "t.target_value", t.unit as "t.unit",
        t.current_progress as "t.current_progress", t.description as "t.description", t.category as "t.category",
        t.start_date as "t.start_date", t.reminder_time as "t.reminder_time", t.archived as "t.archived",
        t.sort_order as "t.sort_order",
        l.log_date as "l.log_date", l.is_completed as "l.is_completed", l.completed_at as "l.completed_at"
     from profile_daily_tasks t
     left join daily_task_log l
       on l.task_id = t.id and l.log_date = $2::date
     where t.profile_id = $1 and t.is_active = true and t.archived = false
     order by t.sort_order, t.id`,
    [profileId, taskDate],
  );

  const tasks = result.rows.map((r) => rowToTask(r, taskDate));
  return tasks.filter((t) => isHabitScheduledToday(t.frequencyType, t.frequencyDays, t.frequencyTarget, dayOfWeek));
}

/**
 * Returns all active habits for the user, regardless of today's schedule.
 * Used by the Consistência page to show all habits with their history.
 */
export async function getAllHabits(profileId: string, taskDate: string): Promise<UserDailyTask[]> {
  parseProfileId(profileId);
  await ensureDailyTasksSchema();

  const result = await pool.query<ListDailyRow>(
    `select
        t.id as "t.id", t.title as "t.title",
        t.icon_type as "t.icon_type", t.icon_value as "t.icon_value", t.color as "t.color",
        t.frequency_type as "t.frequency_type", t.frequency_days as "t.frequency_days", t.frequency_target as "t.frequency_target",
        t.goal_type as "t.goal_type", t.target_value as "t.target_value", t.unit as "t.unit",
        t.current_progress as "t.current_progress", t.description as "t.description", t.category as "t.category",
        t.start_date as "t.start_date", t.reminder_time as "t.reminder_time", t.archived as "t.archived",
        t.sort_order as "t.sort_order",
        l.log_date as "l.log_date", l.is_completed as "l.is_completed", l.completed_at as "l.completed_at"
     from profile_daily_tasks t
     left join daily_task_log l
       on l.task_id = t.id and l.log_date = $2::date
     where t.profile_id = $1 and t.is_active = true and t.archived = false
     order by t.sort_order, t.id`,
    [profileId, taskDate],
  );

  return result.rows.map((r) => rowToTask(r, taskDate));
}

export async function listDailyTaskHistory(
  profileId: string,
  from: string,
  to: string,
): Promise<DailyTaskHistoryEntry[]> {
  parseProfileId(profileId);
  const fromDate = parseDate(from, "Data inicial");
  const toDate = parseDate(to, "Data final");
  if (fromDate > toDate) throw new ValidationError("Intervalo de datas inválido.");
  await ensureDailyTasksSchema();

  const result = await pool.query<{
    task_id: string | number;
    date: string;
    completed_at: Date | string;
  }>(
    `select l.task_id, l.log_date::text as date, l.completed_at
     from daily_task_log l
     join profile_daily_tasks t on t.id = l.task_id
     where t.profile_id = $1 and l.is_completed = true
       and l.log_date >= $2::date and l.log_date <= $3::date
     order by l.log_date, l.task_id`,
    [profileId, fromDate, toDate],
  );

  return result.rows.map((row) => ({
    taskId: Number(row.task_id),
    date: row.date,
    completedAt: new Date(row.completed_at).toISOString(),
  }));
}

export interface CreateHabitPayload {
  title: string;
  iconType?: HabitIconType;
  iconValue?: string;
  color?: string;
  frequencyType?: HabitFrequencyType;
  frequencyDays?: number[] | null;
  frequencyTarget?: number | null;
  goalType?: HabitGoalType;
  targetValue?: number | null;
  unit?: string | null;
  description?: string | null;
  category?: string | null;
  startDate?: string | null;
  reminderTime?: string | null;
}

export async function createDailyTask(
  profileId: string,
  taskDate: string,
  payload: string | CreateHabitPayload,
): Promise<UserDailyTask> {
  parseProfileId(profileId);

  // Support legacy string title
  const p = typeof payload === "string" ? { title: payload } : payload;
  const trimmed = p.title.trim();
  if (!trimmed) throw new ValidationError("Digite o nome do hábito.");
  if (trimmed.length > 40) throw new ValidationError("Nome muito longo (máx. 40 caracteres).");

  await ensureDailyTasksSchema();

  const count = await pool.query<{ n: string | number }>(
    `select count(*)::int as n from profile_daily_tasks where profile_id = $1 and is_active = true and archived = false`,
    [profileId],
  );
  if (Number(count.rows[0]?.n ?? 0) >= HABIT_LIMIT) {
    throw new ForbiddenError(`Você pode ter no máximo ${HABIT_LIMIT} hábitos ativos.`);
  }

  const iconType: HabitIconType = p.iconType || "asset";
  const iconValue = p.iconValue || "target";
  const color = p.color || "#71d4ff";
  const frequencyType: HabitFrequencyType = p.frequencyType || "daily";
  const frequencyDays = p.frequencyDays ?? null;
  const frequencyTarget = p.frequencyTarget ?? null;
  const goalType: HabitGoalType = p.goalType || "check";
  const targetValue = p.targetValue ?? null;
  const unit = p.unit ?? null;
  const description = p.description ?? null;
  const category = p.category ?? null;
  const startDate = p.startDate ?? null;
  const reminderTime = p.reminderTime ?? null;

  const result = await pool.query<{
    id: string | number;
    title: string;
    icon_type: string;
    icon_value: string;
    color: string;
    frequency_type: string;
    frequency_days: unknown;
    frequency_target: string | number | null;
    goal_type: string;
    target_value: string | number | null;
    unit: string | null;
    current_progress: string | number;
    description: string | null;
    category: string | null;
    start_date: string | null;
    reminder_time: string | null;
    archived: boolean;
    sort_order: string | number;
  }>(
    `insert into profile_daily_tasks (
      profile_id, title, icon_type, icon_value, color, frequency_type, frequency_days, frequency_target,
      goal_type, target_value, unit, current_progress, description, category, start_date, reminder_time, archived, sort_order
    )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, $13, $14, $15, false,
       (select coalesce(max(sort_order), 0) + 1 from profile_daily_tasks where profile_id = $1))
     returning id, title, icon_type, icon_value, color, frequency_type, frequency_days, frequency_target,
       goal_type, target_value, unit, current_progress, description, category, start_date, reminder_time, archived, sort_order`,
    [
      profileId, trimmed, iconType, iconValue, color, frequencyType,
      frequencyDays ? `{${frequencyDays.join(",")}}` : null, frequencyTarget,
      goalType, targetValue, unit, description, category, startDate, reminderTime,
    ],
  );

  const r = result.rows[0];
  return {
    id: Number(r.id),
    title: r.title,
    taskDate,
    isCompleted: false,
    iconType: r.icon_type as HabitIconType,
    iconValue: r.icon_value,
    color: r.color,
    frequencyType: r.frequency_type as HabitFrequencyType,
    frequencyDays: r.frequency_days ? (Array.isArray(r.frequency_days) ? r.frequency_days : JSON.parse(r.frequency_days as string)) : null,
    frequencyTarget: r.frequency_target ? Number(r.frequency_target) : null,
    goalType: r.goal_type as HabitGoalType,
    targetValue: r.target_value ? Number(r.target_value) : null,
    unit: r.unit,
    currentProgress: Number(r.current_progress ?? 0),
    description: r.description,
    category: r.category,
    startDate: r.start_date,
    reminderTime: r.reminder_time,
    archived: Boolean(r.archived),
    sortOrder: Number(r.sort_order ?? 0),
  };
}

/**
 * Updates habit metadata (title, icon, color, frequency, goal type, etc.).
 * Does NOT reset today's completion state or re-award rewards.
 */
export async function updateHabitMetadata(
  profileId: string,
  taskId: number,
  updates: {
    title?: string;
    iconType?: HabitIconType;
    iconValue?: string;
    color?: string;
    frequencyType?: HabitFrequencyType;
    frequencyDays?: number[] | null;
    frequencyTarget?: number | null;
    goalType?: HabitGoalType;
    targetValue?: number | null;
    unit?: string | null;
    description?: string | null;
    category?: string | null;
    startDate?: string | null;
    reminderTime?: string | null;
  },
): Promise<UserDailyTask> {
  parseProfileId(profileId);

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (updates.title !== undefined) {
    const trimmed = updates.title.trim();
    if (!trimmed) throw new ValidationError("Digite o nome do hábito.");
    if (trimmed.length > 40) throw new ValidationError("Nome muito longo (máx. 40 caracteres).");
    sets.push(`title = $${idx++}`);
    values.push(trimmed);
  }
  if (updates.iconType !== undefined) { sets.push(`icon_type = $${idx++}`); values.push(updates.iconType); }
  if (updates.iconValue !== undefined) { sets.push(`icon_value = $${idx++}`); values.push(updates.iconValue); }
  if (updates.color !== undefined) { sets.push(`color = $${idx++}`); values.push(updates.color); }
  if (updates.frequencyType !== undefined) { sets.push(`frequency_type = $${idx++}`); values.push(updates.frequencyType); }
  if (updates.frequencyDays !== undefined) { sets.push(`frequency_days = $${idx++}`); values.push(updates.frequencyDays ? `{${updates.frequencyDays.join(",")}}` : null); }
  if (updates.frequencyTarget !== undefined) { sets.push(`frequency_target = $${idx++}`); values.push(updates.frequencyTarget); }
  if (updates.goalType !== undefined) { sets.push(`goal_type = $${idx++}`); values.push(updates.goalType); }
  if (updates.targetValue !== undefined) { sets.push(`target_value = $${idx++}`); values.push(updates.targetValue); }
  if (updates.unit !== undefined) { sets.push(`unit = $${idx++}`); values.push(updates.unit); }
  if (updates.description !== undefined) { sets.push(`description = $${idx++}`); values.push(updates.description); }
  if (updates.category !== undefined) { sets.push(`category = $${idx++}`); values.push(updates.category); }
  if (updates.startDate !== undefined) { sets.push(`start_date = $${idx++}`); values.push(updates.startDate); }
  if (updates.reminderTime !== undefined) { sets.push(`reminder_time = $${idx++}`); values.push(updates.reminderTime); }

  if (sets.length === 0) {
    throw new ValidationError("Nenhuma alteração fornecida.");
  }

  values.push(taskId, profileId);
  const whereIdx = idx;

  const result = await pool.query<{
    id: string | number;
    title: string;
    icon_type: string;
    icon_value: string;
    color: string;
    frequency_type: string;
    frequency_days: unknown;
    frequency_target: string | number | null;
    goal_type: string;
    target_value: string | number | null;
    unit: string | null;
    current_progress: string | number;
    description: string | null;
    category: string | null;
    start_date: string | null;
    reminder_time: string | null;
    archived: boolean;
    sort_order: string | number;
  }>(
    `update profile_daily_tasks set ${sets.join(", ")}
     where id = $${whereIdx} and profile_id = $${whereIdx + 1} and is_active = true
     returning id, title, icon_type, icon_value, color, frequency_type, frequency_days, frequency_target,
       goal_type, target_value, unit, current_progress, description, category, start_date, reminder_time, archived, sort_order`,
    values,
  );
  if (!result.rows[0]) {
    throw new NotFoundError("Hábito não encontrado.");
  }

  const r = result.rows[0];
  // Preserve today's completion status
  const today = todayIso();
  const logResult = await pool.query<{ is_completed: boolean; completed_at: Date | string | null }>(
    `select is_completed, completed_at from daily_task_log where task_id = $1 and log_date = $2::date`,
    [taskId, today],
  );

  return {
    id: Number(r.id),
    title: r.title,
    taskDate: today,
    isCompleted: Boolean(logResult.rows[0]?.is_completed),
    completedAt: logResult.rows[0]?.completed_at ? new Date(logResult.rows[0].completed_at as string).toISOString() : undefined,
    iconType: r.icon_type as HabitIconType,
    iconValue: r.icon_value,
    color: r.color,
    frequencyType: r.frequency_type as HabitFrequencyType,
    frequencyDays: r.frequency_days ? (Array.isArray(r.frequency_days) ? r.frequency_days : JSON.parse(r.frequency_days as string)) : null,
    frequencyTarget: r.frequency_target ? Number(r.frequency_target) : null,
    goalType: r.goal_type as HabitGoalType,
    targetValue: r.target_value ? Number(r.target_value) : null,
    unit: r.unit,
    currentProgress: Number(r.current_progress ?? 0),
    description: r.description,
    category: r.category,
    startDate: r.start_date,
    reminderTime: r.reminder_time,
    archived: Boolean(r.archived),
    sortOrder: Number(r.sort_order ?? 0),
  };
}

/**
 * Logs progress for a measurable habit. If progress reaches the target,
 * marks the habit as completed for today (if not already).
 */
export async function logHabitProgress(
  profileId: string,
  taskId: number,
  progressValue: number,
  taskDate?: string,
): Promise<UserDailyTask> {
  parseProfileId(profileId);
  const date = taskDate ?? todayIso();

  const client = await pool.connect();
  try {
    await client.query("begin");

    const habit = await client.query<{
      goal_type: string;
      target_value: string | number | null;
      current_progress: string | number;
      title: string;
      icon_type: string;
      icon_value: string;
      color: string;
      frequency_type: string;
      frequency_days: unknown;
      frequency_target: string | number | null;
      unit: string | null;
      description: string | null;
      category: string | null;
      start_date: string | null;
      reminder_time: string | null;
      archived: boolean;
      sort_order: string | number;
    }>(
      `select goal_type, target_value, current_progress, title, icon_type, icon_value, color,
        frequency_type, frequency_days, frequency_target, unit, description, category,
        start_date, reminder_time, archived, sort_order
       from profile_daily_tasks where id = $1 and profile_id = $2 and is_active = true`,
      [taskId, profileId],
    );
    if (!habit.rows[0]) throw new NotFoundError("Hábito não encontrado.");

    const h = habit.rows[0];
    if (h.goal_type !== "measurable") {
      throw new ValidationError("Este hábito não é mensurável.");
    }
    const target = Number(h.target_value);
    if (!target || target <= 0) {
      throw new ValidationError("Este hábito não tem um alvo definido.");
    }

    // Add progress
    const newProgress = Number(h.current_progress ?? 0) + progressValue;
    const reachedTarget = newProgress >= target;

    await client.query(
      `update profile_daily_tasks set current_progress = $1 where id = $2`,
      [reachedTarget ? target : newProgress, taskId],
    );

    // Log progress entry
    await client.query(
      `insert into daily_task_log (task_id, log_date, is_completed, completed_at, progress_value)
       values ($1, $2::date, false, null, $3)
       on conflict (task_id, log_date) do update set progress_value = excluded.progress_value`,
      [taskId, date, progressValue],
    );

    // If target reached and not already completed today, mark complete
    if (reachedTarget) {
      const existing = await client.query<{ is_completed: boolean }>(
        `select is_completed from daily_task_log where task_id = $1 and log_date = $2::date`,
        [taskId, date],
      );
      if (!existing.rows[0]?.is_completed) {
        await client.query(
          `update daily_task_log set is_completed = true, completed_at = now() where task_id = $1 and log_date = $2::date`,
          [taskId, date],
        );
      }
    }

    await client.query("commit");

    const logResult = await pool.query<{ is_completed: boolean; completed_at: Date | string | null }>(
      `select is_completed, completed_at from daily_task_log where task_id = $1 and log_date = $2::date`,
      [taskId, date],
    );

    return {
      id: taskId,
      title: h.title,
      taskDate: date,
      isCompleted: Boolean(logResult.rows[0]?.is_completed),
      completedAt: logResult.rows[0]?.completed_at ? new Date(logResult.rows[0].completed_at as string).toISOString() : undefined,
      iconType: h.icon_type as HabitIconType,
      iconValue: h.icon_value,
      color: h.color,
      frequencyType: h.frequency_type as HabitFrequencyType,
      frequencyDays: h.frequency_days ? (Array.isArray(h.frequency_days) ? h.frequency_days : JSON.parse(h.frequency_days as string)) : null,
      frequencyTarget: h.frequency_target ? Number(h.frequency_target) : null,
      goalType: h.goal_type as HabitGoalType,
      targetValue: h.target_value ? Number(h.target_value) : null,
      unit: h.unit,
      currentProgress: reachedTarget ? target : newProgress,
      description: h.description,
      category: h.category,
      startDate: h.start_date,
      reminderTime: h.reminder_time,
      archived: Boolean(h.archived),
      sortOrder: Number(h.sort_order ?? 0),
    };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Reorders habits by updating sort_order.
 */
export async function reorderHabits(profileId: string, taskIds: number[]): Promise<void> {
  parseProfileId(profileId);
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (let i = 0; i < taskIds.length; i++) {
      await client.query(
        `update profile_daily_tasks set sort_order = $1 where id = $2 and profile_id = $3`,
        [i, taskIds[i], profileId],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
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

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`select id from profiles where id = $1 for update`, [profileId]);

    const t = await client.query<TemplateRow>(
      `select id, title from profile_daily_tasks where id = $1 and profile_id = $2 for update`,
      [taskId, profileId],
    );
    if (!t.rows[0]) throw new NotFoundError("Tarefa diária não encontrada.");

    const existing = await client.query<LogRow>(
      `select task_id, log_date, is_completed, completed_at
       from daily_task_log where task_id = $1 and log_date = $2::date for update`,
      [taskId, date],
    );
    const alreadyDone = Boolean(existing.rows[0]?.is_completed);

    if (completed && !alreadyDone) {
      await client.query(
        `insert into daily_task_log (task_id, log_date, is_completed, completed_at)
         values ($1, $2::date, true, now())
         on conflict (task_id, log_date) do update set is_completed = true, completed_at = now()`,
        [taskId, date],
      );
    } else if (!completed && alreadyDone) {
      await client.query(
        `update daily_task_log set is_completed = false, completed_at = null
         where task_id = $1 and log_date = $2::date`,
        [taskId, date],
      );
    }

    let xpAwarded = 0;
    let coinsAwarded = 0;

    if (completed && !alreadyDone) {
      xpAwarded = await creditXP(profileId, "daily_task", `${taskId}:${date}`, HABIT_XP, {
        questDate: date,
        db: client,
      });
      if (xpAwarded > 0) {
        coinsAwarded = HABIT_COINS;
        await recordMissionProgress(profileId, "TASKS_COMPLETED", {
          incrementBy: 1,
          questDate: date,
          client,
        });
        await addCoins(profileId, coinsAwarded, client);

        const allToday = await client.query<{ total: string | number; completed: string | number }>(
          `select count(*)::int as total,
                  count(*) filter (where l.is_completed = true)::int as completed
           from profile_daily_tasks t
           left join daily_task_log l on l.task_id = t.id and l.log_date = $2::date
           where t.profile_id = $1 and t.is_active = true and t.archived = false`,
          [profileId, date],
        );
        const { total, completed: doneCount } = allToday.rows[0];
        if (Number(total) > 0 && Number(total) === Number(doneCount)) {
          coinsAwarded += HABIT_ALL_BONUS_COINS;
          await addCoins(profileId, HABIT_ALL_BONUS_COINS, client);
        }
      }
    }

    await client.query("commit");

    const task: UserDailyTask = {
      id: taskId,
      title: t.rows[0].title,
      taskDate: date,
      isCompleted: completed,
      completedAt: completed
        ? alreadyDone && existing.rows[0]?.completed_at
          ? new Date(existing.rows[0].completed_at).toISOString()
          : new Date().toISOString()
        : undefined,
    };
    return { task, xpAwarded, coinsAwarded };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export { todayIso } from "./dates";
export {
  HABIT_LIMIT,
  HABIT_XP,
  HABIT_COINS,
  HABIT_ALL_BONUS_COINS,
  DAILY_TASK_LIMIT,
  DAILY_TASK_XP,
  DAILY_TASK_COINS,
  DAILY_TASK_ALL_BONUS_COINS,
} from "../daily-limits";
