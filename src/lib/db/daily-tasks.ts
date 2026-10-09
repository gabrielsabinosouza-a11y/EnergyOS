import pool from "../db";
import { ForbiddenError, NotFoundError } from "../errors";
import { parseDate, parseProfileId, ValidationError } from "./validation";
import { todayIso } from "./dates";
import { isHabitScheduledOnDate } from "../habit-schedule";
import { getHabitAsset } from "../habit-icons";
import { recordMissionProgress } from "./daily-quests";
import { clampDailyProgress, normalizeDailyTarget } from "../daily-habit-progress";
import { addCoins } from "./settings";
import { creditXP } from "./xp";
import { ensureXpLedgerSourceCheck } from "./xp-ledger";

import {
  HABIT_LIMIT,
  HABIT_DAILY_REWARD_LIMIT,
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
  dailyTarget: number;
  completedCount: number;
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
  dailyTarget: 1,
};

export interface DailyTaskHistoryEntry {
  taskId: number;
  date: string;
  completedAt: string;
}

interface TemplateRow {
  id: string | number;
  title: string;
  icon_type: HabitIconType | null;
  icon_value: string | null;
  color: string | null;
  frequency_type: HabitFrequencyType;
  frequency_days: unknown;
  frequency_target: string | number | null;
  goal_type: HabitGoalType | null;
  target_value: string | number | null;
  unit: string | null;
  current_progress: string | number | null;
  description: string | null;
  category: string | null;
  start_date: string | null;
  reminder_time: string | null;
  archived: boolean | null;
  sort_order: string | number | null;
  daily_target: string | number | null;
}

interface LogRow {
  task_id: string | number;
  log_date: Date | string;
  is_completed: boolean;
  completed_at: Date | string | null;
  completion_count: string | number | null;
  rewards_claimed: boolean | null;
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
  "t.daily_target": string | number | null;
  "l.log_date": Date | string | null;
  "l.is_completed": boolean | null;
  "l.completed_at": Date | string | null;
  "l.completion_count": string | number | null;
}

/** Check if a habit is scheduled for a given day (0=Sun, 1=Mon, ... 6=Sat). */
/** Map a row to a UserDailyTask, applying defaults for missing fields. */
function rowToTask(r: ListDailyRow, taskDate: string): UserDailyTask {
  const dailyTarget = normalizeDailyTarget(Number(r["t.daily_target"] ?? 1));
  const completedCount = clampDailyProgress(Number(r["l.completion_count"] ?? (r["l.is_completed"] ? dailyTarget : 0)), dailyTarget);
  return {
    id: Number(r["t.id"]),
    title: r["t.title"],
    taskDate,
    isCompleted: completedCount >= dailyTarget,
    completedAt: r["l.completed_at"] ? new Date(r["l.completed_at"] as string).toISOString() : undefined,
    dailyTarget,
    completedCount,
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
  await pool.query(`alter table profile_daily_tasks add column if not exists daily_target integer not null default 1`);
  await pool.query(`
    do $$ begin
      alter table profile_daily_tasks add constraint profile_daily_tasks_daily_target_check check (daily_target >= 1);
    exception when duplicate_object then null;
    end $$
  `);

  // ── daily_task_log progress column ──
  await pool.query(`alter table daily_task_log add column if not exists progress_value numeric`);

  await pool.query(`
    create table if not exists daily_task_log (
      task_id bigint not null references profile_daily_tasks(id) on delete cascade,
      log_date date not null,
      is_completed boolean not null default false,
      completed_at timestamptz,
      completion_count integer not null default 0,
      rewards_claimed boolean not null default false,
      primary key (task_id, log_date)
    )
  `);
  await pool.query(`alter table daily_task_log add column if not exists completion_count integer not null default 0`);
  await pool.query(`alter table daily_task_log add column if not exists rewards_claimed boolean not null default false`);
  await pool.query(`
    update daily_task_log l set completion_count = t.daily_target
    from profile_daily_tasks t
    where l.task_id = t.id and l.is_completed = true and l.completion_count = 0
  `);
  await pool.query(`update daily_task_log set rewards_claimed = true where is_completed = true and rewards_claimed = false`);
  await pool.query(`
    create table if not exists daily_habit_bonus_log (
      profile_id text not null references profiles(id) on delete cascade,
      bonus_date date not null,
      coins_awarded integer not null,
      primary key (profile_id, bonus_date)
    )
  `);
  // Ensure the xp_ledger source CHECK constraint exists with the COMPLETE list
  // of valid sources.  Previously this function dropped and re-created the
  // constraint with an incomplete list (omitting 'weekly_plan' and
  // 'weekly_plan_occurrence'), which crashed with check_violation (23514) the
  // moment a weekly-plan occurrence wrote to xp_ledger — taking down every
  // habit endpoint with a 500.  The constraint management is now centralised
  // in ensureXpLedgerSourceCheck() to prevent the two callers from drifting.
  await ensureXpLedgerSourceCheck();
}

/**
 * Lists the user's habits scheduled for a given day, with completion status.
 * Filters by frequency so habits not scheduled for today are excluded.
 */
export async function listDailyTasks(profileId: string, taskDate: string): Promise<UserDailyTask[]> {
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
        t.sort_order as "t.sort_order", t.daily_target as "t.daily_target",
        l.log_date as "l.log_date", l.is_completed as "l.is_completed", l.completed_at as "l.completed_at",
        l.completion_count as "l.completion_count"
     from profile_daily_tasks t
     left join daily_task_log l
       on l.task_id = t.id and l.log_date = $2::date
     where t.profile_id = $1 and t.is_active = true and t.archived = false
     order by t.sort_order, t.id`,
    [profileId, taskDate],
  );

  const tasks = result.rows.map((r) => rowToTask(r, taskDate));
  return tasks.filter((t) => isHabitScheduledOnDate(t.frequencyType, t.frequencyDays, t.frequencyTarget, taskDate));
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
        t.sort_order as "t.sort_order", t.daily_target as "t.daily_target",
        l.log_date as "l.log_date", l.is_completed as "l.is_completed", l.completed_at as "l.completed_at",
        l.completion_count as "l.completion_count"
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
  dailyTarget?: number;
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

function validateHabitIcon(type: HabitIconType, value: string): string {
  if (type === "asset") return getHabitAsset(value).id;
  if (type === "emoji") {
    if (!value || value.length > 16) throw new ValidationError("Emoji de hábito inválido.");
    return value;
  }
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  let url: URL;
  try { url = new URL(value); } catch { throw new ValidationError("URL da imagem inválida."); }
  if (!cloudName || url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || !url.pathname.startsWith(`/${cloudName}/image/upload/`)) {
    throw new ValidationError("A imagem precisa estar hospedada na conta Cloudinary do energyOS.");
  }
  return url.toString();
}

export async function createDailyTask(
  profileId: string,
  taskDate: string,
  payload: string | CreateHabitPayload,
): Promise<UserDailyTask> {
  parseProfileId(profileId);
  const p = typeof payload === "string" ? { title: payload } : payload;
  if (!p || typeof p.title !== "string") throw new ValidationError("Digite o nome do hábito.");
  const trimmed = p.title.trim();
  if (!trimmed) throw new ValidationError("Digite o nome do hábito.");
  if (trimmed.length > 40) throw new ValidationError("Nome muito longo (máx. 40 caracteres).");
  const dailyTarget = p.dailyTarget ?? 1;
  if (!Number.isInteger(dailyTarget) || dailyTarget < 1) throw new ValidationError("A meta diária deve ser um número inteiro maior que zero.");
  await ensureDailyTasksSchema();

  const iconType = p.iconType || "asset";
  if (!["asset", "emoji", "image"].includes(iconType)) throw new ValidationError("Tipo de ícone inválido.");
  const iconValue = validateHabitIcon(iconType, p.iconValue || "target");
  const color = p.color || "#71d4ff";
  const frequencyType: HabitFrequencyType = p.frequencyType || "daily";
  if (!["daily", "weekdays", "times_per_week"].includes(frequencyType)) throw new ValidationError("Frequência inválida.");
  const frequencyDays = p.frequencyDays ?? null;
  if (frequencyDays && (!Array.isArray(frequencyDays) || frequencyDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) throw new ValidationError("Dias da semana inválidos.");
  const frequencyTarget = p.frequencyTarget ?? null;
  if (frequencyType === "times_per_week" && (!Number.isInteger(frequencyTarget) || Number(frequencyTarget) < 1 || Number(frequencyTarget) > 7)) throw new ValidationError("Escolha de 1 a 7 dias por semana.");
  const goalType: HabitGoalType = p.goalType || "check";
  if (!["check", "measurable"].includes(goalType)) throw new ValidationError("Tipo de meta inválido.");
  const targetValue = p.targetValue ?? null;
  if (targetValue !== null && (!Number.isFinite(Number(targetValue)) || Number(targetValue) <= 0)) throw new ValidationError("Valor alvo inválido.");

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`select id from profiles where id = $1 for update`, [profileId]);
    const count = await client.query<{ n: string | number }>(
      `select count(*)::int as n from profile_daily_tasks where profile_id = $1 and is_active = true and archived = false`,
      [profileId],
    );
    if (Number(count.rows[0]?.n ?? 0) >= HABIT_LIMIT) {
      throw new ForbiddenError(`Você pode ter no máximo ${HABIT_LIMIT} hábitos ativos.`);
    }

    const result = await client.query<{
      id: string | number; title: string; icon_type: string; icon_value: string; color: string;
      frequency_type: string; frequency_days: unknown; frequency_target: string | number | null;
      goal_type: string; target_value: string | number | null; unit: string | null;
      current_progress: string | number; description: string | null; category: string | null;
      start_date: string | null; reminder_time: string | null; archived: boolean; sort_order: string | number;
      daily_target: string | number;
    }>(
      `insert into profile_daily_tasks (
        profile_id, title, icon_type, icon_value, color, frequency_type, frequency_days, frequency_target,
        goal_type, target_value, unit, current_progress, description, category, start_date, reminder_time, archived, sort_order, daily_target
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, $13, $14, $15, false,
        (select coalesce(max(sort_order), 0) + 1 from profile_daily_tasks where profile_id = $1), $16)
      returning id, title, icon_type, icon_value, color, frequency_type, frequency_days, frequency_target,
        goal_type, target_value, unit, current_progress, description, category, start_date, reminder_time, archived, sort_order, daily_target`,
      [profileId, trimmed, iconType, iconValue, color, frequencyType,
        frequencyDays ? `{${frequencyDays.join(",")}}` : null, frequencyTarget,
        goalType, targetValue, p.unit ?? null, p.description ?? null, p.category ?? null,
        p.startDate ?? null, p.reminderTime ?? null, dailyTarget],
    );
    await client.query("commit");
    const r = result.rows[0];
    return {
      id: Number(r.id), title: r.title, taskDate, isCompleted: false, dailyTarget: normalizeDailyTarget(Number(r.daily_target)), completedCount: 0,
      iconType: r.icon_type as HabitIconType, iconValue: r.icon_value, color: r.color,
      frequencyType: r.frequency_type as HabitFrequencyType,
      frequencyDays: r.frequency_days ? (Array.isArray(r.frequency_days) ? r.frequency_days : JSON.parse(r.frequency_days as string)) : null,
      frequencyTarget: r.frequency_target ? Number(r.frequency_target) : null,
      goalType: r.goal_type as HabitGoalType, targetValue: r.target_value ? Number(r.target_value) : null,
      unit: r.unit, currentProgress: Number(r.current_progress ?? 0), description: r.description,
      category: r.category, startDate: r.start_date, reminderTime: r.reminder_time,
      archived: Boolean(r.archived), sortOrder: Number(r.sort_order ?? 0),
    };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
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
    dailyTarget?: number;
  },
): Promise<UserDailyTask> {
  parseProfileId(profileId);

  const existingIcon = await pool.query<{ icon_type: HabitIconType; icon_value: string }>(
    `select icon_type, icon_value from profile_daily_tasks where id = $1 and profile_id = $2`,
    [taskId, profileId],
  );
  if (!existingIcon.rows[0]) throw new NotFoundError("Hábito não encontrado.");
  const nextIconType = updates.iconType ?? existingIcon.rows[0].icon_type;
  const nextIconValue = updates.iconValue ?? existingIcon.rows[0].icon_value;
  if (!["asset", "emoji", "image"].includes(nextIconType)) throw new ValidationError("Tipo de ícone inválido.");
  const normalizedIconValue = validateHabitIcon(nextIconType, nextIconValue);
  if (updates.iconValue !== undefined || updates.iconType !== undefined) {
    updates = { ...updates, iconType: nextIconType, iconValue: normalizedIconValue };
  }

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
  if (updates.dailyTarget !== undefined) {
    if (!Number.isInteger(updates.dailyTarget) || updates.dailyTarget < 1) throw new ValidationError("A meta diária deve ser um número inteiro maior que zero.");
    sets.push(`daily_target = $${idx++}`);
    values.push(updates.dailyTarget);
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
    daily_target: string | number;
  }>(
    `update profile_daily_tasks set ${sets.join(", ")}
     where id = $${whereIdx} and profile_id = $${whereIdx + 1} and is_active = true
     returning id, title, icon_type, icon_value, color, frequency_type, frequency_days, frequency_target,
       goal_type, target_value, unit, current_progress, description, category, start_date, reminder_time, archived, sort_order, daily_target`,
    values,
  );
  if (!result.rows[0]) {
    throw new NotFoundError("Hábito não encontrado.");
  }

  const r = result.rows[0];
  const today = todayIso();
  if (updates.dailyTarget !== undefined) {
    // Keep today's count within the new target and recompute its completion
    // state. Editing a target never awards completion rewards.
    await pool.query(
      `update daily_task_log
          set completion_count = least(completion_count, $3),
              is_completed = least(completion_count, $3) >= $3,
              completed_at = case
                when least(completion_count, $3) >= $3 then coalesce(completed_at, now())
                else null
              end,
              rewards_claimed = case
                when least(completion_count, $3) >= $3 then true
                else rewards_claimed
              end
        where task_id = $1 and log_date = $2::date`,
      [taskId, today, Number(r.daily_target)],
    );
  }
  const logResult = await pool.query<{ is_completed: boolean; completed_at: Date | string | null; completion_count: string | number | null }>(
    `select is_completed, completed_at, completion_count from daily_task_log where task_id = $1 and log_date = $2::date`,
    [taskId, today],
  );

  return {
    id: Number(r.id),
    title: r.title,
    taskDate: today,
    dailyTarget: normalizeDailyTarget(Number(r.daily_target)),
    completedCount: clampDailyProgress(Number(logResult.rows[0]?.completion_count ?? (logResult.rows[0]?.is_completed ? r.daily_target : 0)), normalizeDailyTarget(Number(r.daily_target))),
    isCompleted: clampDailyProgress(Number(logResult.rows[0]?.completion_count ?? (logResult.rows[0]?.is_completed ? r.daily_target : 0)), normalizeDailyTarget(Number(r.daily_target))) >= normalizeDailyTarget(Number(r.daily_target)),
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
      daily_target: string | number;
    }>(
      `select goal_type, target_value, current_progress, title, icon_type, icon_value, color,
        frequency_type, frequency_days, frequency_target, unit, description, category,
        start_date, reminder_time, archived, sort_order, daily_target
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
      `insert into daily_task_log (task_id, log_date, is_completed, completed_at, progress_value, completion_count)
       values ($1, $2::date, false, null, $3, 0)
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
          `update daily_task_log set is_completed = true, completed_at = now(), completion_count = $3, rewards_claimed = true where task_id = $1 and log_date = $2::date`,
          [taskId, date, normalizeDailyTarget(Number(h.daily_target))],
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
      dailyTarget: normalizeDailyTarget(Number(h.daily_target)),
      completedCount: Boolean(logResult.rows[0]?.is_completed) ? normalizeDailyTarget(Number(h.daily_target)) : 0,
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
async function updateDailyTaskProgress(
  profileId: string,
  taskId: number,
  requestedCount: number | null,
  taskDate?: string,
): Promise<{ task: UserDailyTask; xpAwarded: number; coinsAwarded: number; completionTriggered: boolean }> {
  parseProfileId(profileId);
  const date = taskDate ?? todayIso();
  await ensureDailyTasksSchema();

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`select id from profiles where id = $1 for update`, [profileId]);

    const t = await client.query<TemplateRow>(
      `select id, title, icon_type, icon_value, color, frequency_type, frequency_days, frequency_target,
              goal_type, target_value, unit, current_progress, description, category, start_date, reminder_time, archived, sort_order, daily_target
         from profile_daily_tasks where id = $1 and profile_id = $2 for update`,
      [taskId, profileId],
    );
    if (!t.rows[0]) throw new NotFoundError("Tarefa diária não encontrada.");
    const taskDays = t.rows[0].frequency_days
      ? (Array.isArray(t.rows[0].frequency_days) ? t.rows[0].frequency_days : JSON.parse(String(t.rows[0].frequency_days))) as number[]
      : null;
    if ((requestedCount === null || requestedCount > 0) && !isHabitScheduledOnDate(t.rows[0].frequency_type, taskDays, Number(t.rows[0].frequency_target) || null, date)) {
      throw new ValidationError("Este hábito não está programado para hoje.");
    }

    const existing = await client.query<LogRow>(
      `select task_id, log_date, is_completed, completed_at, completion_count, rewards_claimed
       from daily_task_log where task_id = $1 and log_date = $2::date for update`,
      [taskId, date],
    );
    const dailyTarget = normalizeDailyTarget(Number(t.rows[0].daily_target ?? 1));
    const previousCount = clampDailyProgress(
      Number(existing.rows[0]?.completion_count ?? (existing.rows[0]?.is_completed ? dailyTarget : 0)),
      dailyTarget,
    );
    const completedCount = requestedCount === null ? dailyTarget : clampDailyProgress(requestedCount, dailyTarget);
    const wasCompleted = previousCount >= dailyTarget;
    const isCompleted = completedCount >= dailyTarget;
    const alreadyRewarded = Boolean(existing.rows[0]?.rewards_claimed ?? existing.rows[0]?.is_completed);
    const completionTriggered = !wasCompleted && isCompleted && !alreadyRewarded;
    const rewardsClaimed = alreadyRewarded || completionTriggered;

    await client.query(
      `insert into daily_task_log (task_id, log_date, completion_count, is_completed, completed_at, rewards_claimed)
       values ($1, $2::date, $3, $4, case when $4 then now() else null end, $5)
       on conflict (task_id, log_date) do update set
         completion_count = excluded.completion_count,
         is_completed = excluded.is_completed,
         completed_at = case
           when excluded.is_completed then coalesce(daily_task_log.completed_at, now())
           else null
         end,
         rewards_claimed = daily_task_log.rewards_claimed or excluded.rewards_claimed`,
      [taskId, date, completedCount, isCompleted, rewardsClaimed],
    );

    let xpAwarded = 0;
    let coinsAwarded = 0;

    if (completionTriggered) {
      const rewardedToday = await client.query<{ n: string | number }>(
        `select count(*)::int as n from xp_ledger
          where profile_id = $1 and source = 'daily_task' and source_id like '%:' || $2::text`,
        [profileId, date],
      );
      if (Number(rewardedToday.rows[0]?.n ?? 0) < HABIT_DAILY_REWARD_LIMIT) {
        xpAwarded = await creditXP(profileId, "daily_task", `${taskId}:${date}`, HABIT_XP, {
          questDate: date,
          db: client,
        });
        if (xpAwarded > 0) {
          coinsAwarded = HABIT_COINS;
          await addCoins(profileId, coinsAwarded, client);
        }
      }

      await recordMissionProgress(profileId, "TASKS_COMPLETED", {
        incrementBy: 1,
        questDate: date,
        client,
      });

      const scheduled = await client.query<{
        id: string | number;
        frequency_type: HabitFrequencyType;
        frequency_days: unknown;
        frequency_target: string | number | null;
        is_completed: boolean | null;
        completion_count: string | number | null;
        daily_target: string | number | null;
      }>(
        `select t.id, t.frequency_type, t.frequency_days, t.frequency_target, t.daily_target,
                l.is_completed, l.completion_count
           from profile_daily_tasks t
           left join daily_task_log l on l.task_id = t.id and l.log_date = $2::date
          where t.profile_id = $1 and t.is_active = true and t.archived = false`,
        [profileId, date],
      );
      const dueToday = scheduled.rows.filter((row) => {
        const days = row.frequency_days
          ? (Array.isArray(row.frequency_days) ? row.frequency_days : JSON.parse(String(row.frequency_days))) as number[]
          : null;
        return isHabitScheduledOnDate(row.frequency_type, days, Number(row.frequency_target) || null, date);
      });
      if (dueToday.length > 0 && dueToday.every((row) => clampDailyProgress(
        Number(row.completion_count ?? (row.is_completed ? Number(row.daily_target ?? 1) : 0)),
        normalizeDailyTarget(Number(row.daily_target ?? 1)),
      ) >= normalizeDailyTarget(Number(row.daily_target ?? 1)))) {
        const bonus = await client.query(
          `insert into daily_habit_bonus_log (profile_id, bonus_date, coins_awarded)
           values ($1, $2::date, $3) on conflict (profile_id, bonus_date) do nothing returning profile_id`,
          [profileId, date, HABIT_ALL_BONUS_COINS],
        );
        if (bonus.rowCount) {
          coinsAwarded += HABIT_ALL_BONUS_COINS;
          await addCoins(profileId, HABIT_ALL_BONUS_COINS, client);
        }
      }
    }

    await client.query("commit");

    const task: UserDailyTask = {
      ...DEFAULT_HABIT_FIELDS,
      id: taskId,
      title: t.rows[0].title,
      taskDate: date,
      isCompleted,
      dailyTarget,
      completedCount,
      completedAt: isCompleted
        ? wasCompleted && existing.rows[0]?.completed_at
          ? new Date(existing.rows[0].completed_at).toISOString()
          : new Date().toISOString()
        : undefined,
      iconType: t.rows[0].icon_type || DEFAULT_HABIT_FIELDS.iconType,
      iconValue: t.rows[0].icon_value || DEFAULT_HABIT_FIELDS.iconValue,
      color: t.rows[0].color || DEFAULT_HABIT_FIELDS.color,
      frequencyType: t.rows[0].frequency_type || DEFAULT_HABIT_FIELDS.frequencyType,
      frequencyDays: taskDays,
      frequencyTarget: t.rows[0].frequency_target ? Number(t.rows[0].frequency_target) : null,
      goalType: t.rows[0].goal_type || DEFAULT_HABIT_FIELDS.goalType,
      targetValue: t.rows[0].target_value ? Number(t.rows[0].target_value) : null,
      unit: t.rows[0].unit,
      currentProgress: Number(t.rows[0].current_progress ?? 0),
      description: t.rows[0].description,
      category: t.rows[0].category,
      startDate: t.rows[0].start_date,
      reminderTime: t.rows[0].reminder_time,
      archived: Boolean(t.rows[0].archived),
      sortOrder: Number(t.rows[0].sort_order ?? 0),
    };
    return { task, xpAwarded, coinsAwarded, completionTriggered };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Set today's count. Values beyond the target and below zero are clamped server-side. */
export async function setDailyTaskProgress(
  profileId: string,
  taskId: number,
  completedCount: number,
  taskDate?: string,
): Promise<{ task: UserDailyTask; xpAwarded: number; coinsAwarded: number; completionTriggered: boolean }> {
  if (!Number.isInteger(completedCount)) throw new ValidationError("A contagem diária deve ser um número inteiro.");
  return updateDailyTaskProgress(profileId, taskId, completedCount, taskDate);
}

/** Compatibility API for older checklist widgets. */
export async function toggleDailyTask(
  profileId: string,
  taskId: number,
  completed: boolean,
  taskDate?: string,
): Promise<{ task: UserDailyTask; xpAwarded: number; coinsAwarded: number; completionTriggered: boolean }> {
  return updateDailyTaskProgress(profileId, taskId, completed ? null : 0, taskDate);
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
