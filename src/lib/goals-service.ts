import pool, { mapGoalRow, mapHabitRow, type DbGoalRow, type DbHabitRow, type HabitWithCompletion } from "./db";
import { GOAL_SELECT } from "./db/goals";
import { assertCategoryForProfile, resolveDefaultCategoryId } from "./db/categories";
import type { Goal, Habit, UserSettings } from "@/types";
import { parseProfileId } from "./db/validation";

const GOAL_FREQUENCIES = ["daily", "weekly", "monthly"] as const;
const HABIT_FREQUENCIES = ["daily", "weekly"] as const;
const THEMES = ["system", "light", "dark"] as const;

function requireProfileId(profileId: string) {
  return parseProfileId(profileId);
}

function validateTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("O título é obrigatório.");
  if (trimmed.length > 200) throw new Error("O título deve ter no máximo 200 caracteres.");
  return trimmed;
}

function validateTargetValue(value: number) {
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) {
    throw new Error("Valor alvo deve ser um número positivo.");
  }
  return value;
}

export async function ensureProfile(profileId: string, displayName?: string) {
  const dbProfileId = requireProfileId(profileId);
  await pool.query(
    `insert into profiles (id, display_name) values ($1, $2)
     on conflict (id) do update set display_name = coalesce(nullif(excluded.display_name, ''), profiles.display_name)`,
    [dbProfileId, displayName?.trim() ?? ""],
  );
}

export interface GoalWithHabits {
  goal: Goal;
  habits: HabitWithCompletion[];
}

export async function listGoalsWithHabits(profileId: string): Promise<GoalWithHabits[]> {
  const dbProfileId = requireProfileId(profileId);
  const goalsResult = await pool.query<DbGoalRow>(
    `${GOAL_SELECT}
     where g.profile_id = $1
     order by g.created_at desc, g.id desc`,
    [dbProfileId],
  );
  const habitsResult = await pool.query<DbHabitRow>(
    `select h.id, h.goal_id, h.title, h.frequency, h.active,
            exists (
              select 1 from habit_completions hc
              where hc.habit_id = h.id and hc.completed_date = current_date
            ) as completed_today
     from habits h
     join goals g on g.id = h.goal_id
     where g.profile_id = $1
     order by h.active desc, h.id`,
    [dbProfileId],
  );

  const habits = habitsResult.rows.map(mapHabitRow);
  return goalsResult.rows.map((row) => {
    const goal = mapGoalRow(row);
    return { goal, habits: habits.filter((h) => h.goalId === goal.id) };
  });
}

export interface CreateGoalInput {
  title: string;
  categoryId?: number;
  targetValue: number;
  frequency: Goal["frequency"];
}

export async function createGoal(profileId: string, input: CreateGoalInput): Promise<Goal> {
  const dbProfileId = requireProfileId(profileId);
  await ensureProfile(profileId);
  if (!GOAL_FREQUENCIES.includes(input.frequency)) throw new Error("Frequência inválida.");
  const title = validateTitle(input.title);
  const targetValue = validateTargetValue(input.targetValue);
  const categoryId = input.categoryId !== undefined
    ? await assertCategoryForProfile(dbProfileId, input.categoryId)
    : await resolveDefaultCategoryId();

  const inserted = await pool.query<{ id: string | number }>(
    `insert into goals (profile_id, title, category_id, target_value, frequency)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [dbProfileId, title, categoryId, targetValue, input.frequency],
  );
  const result = await pool.query<DbGoalRow>(`${GOAL_SELECT} where g.id = $1`, [inserted.rows[0].id]);
  return mapGoalRow(result.rows[0]);
}

export interface UpdateGoalPatch {
  title?: string;
  categoryId?: number;
  targetValue?: number;
  currentValue?: number;
  frequency?: Goal["frequency"];
}

export async function updateGoal(profileId: string, goalId: number, patch: UpdateGoalPatch): Promise<Goal> {
  const dbProfileId = requireProfileId(profileId);
  if (!Number.isInteger(goalId) || goalId <= 0) throw new Error("Meta inválida.");

  const updates: string[] = [];
  const values: (string | number)[] = [dbProfileId, goalId];

  if (patch.title !== undefined) {
    values.push(validateTitle(patch.title));
    updates.push(`title = $${values.length}`);
  }
  if (patch.categoryId !== undefined) {
    const categoryId = await assertCategoryForProfile(dbProfileId, patch.categoryId);
    values.push(categoryId);
    updates.push(`category_id = $${values.length}`);
  }
  if (patch.targetValue !== undefined) {
    values.push(validateTargetValue(patch.targetValue));
    updates.push(`target_value = $${values.length}`);
  }
  if (patch.currentValue !== undefined) {
    if (!Number.isFinite(patch.currentValue) || patch.currentValue < 0) throw new Error("Progresso inválido.");
    values.push(patch.currentValue);
    updates.push(`current_value = $${values.length}`);
  }
  if (patch.frequency !== undefined) {
    if (!GOAL_FREQUENCIES.includes(patch.frequency)) throw new Error("Frequência inválida.");
    values.push(patch.frequency);
    updates.push(`frequency = $${values.length}`);
  }

  if (updates.length === 0) throw new Error("Nada para atualizar.");

  const updated = await pool.query<{ id: string | number }>(
    `update goals set ${updates.join(", ")}
     where profile_id = $1 and id = $2
     returning id`,
    values,
  );
  if (!updated.rows[0]) throw new Error("Meta não encontrada.");
  const result = await pool.query<DbGoalRow>(`${GOAL_SELECT} where g.id = $1`, [updated.rows[0].id]);
  return mapGoalRow(result.rows[0]);
}

export async function deleteGoal(profileId: string, goalId: number): Promise<void> {
  const dbProfileId = requireProfileId(profileId);
  const result = await pool.query(`delete from goals where profile_id = $1 and id = $2`, [dbProfileId, goalId]);
  if (result.rowCount === 0) throw new Error("Meta não encontrada.");
}

export async function updateGoalProgress(profileId: string, goalId: number, currentValue: number): Promise<Goal> {
  return updateGoal(profileId, goalId, { currentValue });
}

export interface CreateHabitInput {
  goalId: number;
  title: string;
  frequency: Habit["frequency"];
}

export async function createHabit(profileId: string, input: CreateHabitInput): Promise<HabitWithCompletion> {
  const dbProfileId = requireProfileId(profileId);
  if (!Number.isInteger(input.goalId) || input.goalId <= 0) throw new Error("Meta inválida.");
  if (!HABIT_FREQUENCIES.includes(input.frequency)) throw new Error("Frequência inválida.");
  const title = validateTitle(input.title);

  const owner = await pool.query(`select 1 from goals where id = $1 and profile_id = $2`, [input.goalId, dbProfileId]);
  if (!owner.rows[0]) throw new Error("Meta não encontrada.");

  const result = await pool.query<DbHabitRow>(
    `insert into habits (goal_id, title, frequency) values ($1, $2, $3)
     returning id, goal_id, title, frequency, active, false as completed_today`,
    [input.goalId, title, input.frequency],
  );
  return mapHabitRow(result.rows[0]);
}

async function requireOwnedHabit(profileId: string, habitId: number) {
  const dbProfileId = requireProfileId(profileId);
  const owner = await pool.query(
    `select h.id from habits h join goals g on g.id = h.goal_id where h.id = $1 and g.profile_id = $2`,
    [habitId, dbProfileId],
  );
  if (!owner.rows[0]) throw new Error("Hábito não encontrado.");
}

export async function setHabitActive(profileId: string, habitId: number, active: boolean): Promise<void> {
  requireProfileId(profileId);
  if (!Number.isInteger(habitId) || habitId <= 0) throw new Error("Hábito inválido.");
  await requireOwnedHabit(profileId, habitId);
  await pool.query(`update habits set active = $2 where id = $1`, [habitId, active]);
}

export async function deleteHabit(profileId: string, habitId: number): Promise<void> {
  requireProfileId(profileId);
  if (!Number.isInteger(habitId) || habitId <= 0) throw new Error("Hábito inválido.");
  await requireOwnedHabit(profileId, habitId);
  await pool.query(`delete from habits where id = $1`, [habitId]);
}

export async function toggleHabitCompletion(profileId: string, habitId: number, date: string): Promise<boolean> {
  const dbProfileId = requireProfileId(profileId);
  if (!Number.isInteger(habitId) || habitId <= 0) throw new Error("Hábito inválido.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Data inválida (use YYYY-MM-DD).");
  await requireOwnedHabit(profileId, habitId);

  const existing = await pool.query(
    `select 1 from habit_completions where habit_id = $1 and completed_date = $2`,
    [habitId, date],
  );

  if (existing.rows[0]) {
    await pool.query(`delete from habit_completions where habit_id = $1 and completed_date = $2`, [habitId, date]);
    return false;
  }
  await pool.query(
    `insert into habit_completions (habit_id, profile_id, completed_date) values ($1, $2, $3)
     on conflict (habit_id, completed_date) do nothing`,
    [habitId, dbProfileId, date],
  );
  return true;
}

export interface SaveUserSettingsInput {
  notificationsEnabled: boolean;
  preferredTheme: UserSettings["preferredTheme"];
  sleepTime?: string;
  focusTime?: string;
}

export async function saveUserSettings(profileId: string, input: SaveUserSettingsInput): Promise<UserSettings> {
  const dbProfileId = requireProfileId(profileId);
  await ensureProfile(profileId);
  if (!THEMES.includes(input.preferredTheme)) throw new Error("Tema inválido.");
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
  if (input.sleepTime && !timePattern.test(input.sleepTime)) throw new Error("Horário de sono inválido.");
  if (input.focusTime && !timePattern.test(input.focusTime)) throw new Error("Horário de foco inválido.");

  const result = await pool.query(
    `insert into user_settings (profile_id, notifications_enabled, preferred_theme, sleep_time, focus_time)
     values ($1, $2, $3, $4, $5)
     on conflict (profile_id) do update set
       notifications_enabled = excluded.notifications_enabled,
       preferred_theme = excluded.preferred_theme,
       sleep_time = excluded.sleep_time,
       focus_time = excluded.focus_time
     returning notifications_enabled, preferred_theme, sleep_time, focus_time`,
    [
      dbProfileId,
      input.notificationsEnabled,
      input.preferredTheme,
      input.sleepTime ?? null,
      input.focusTime ?? null,
    ],
  );

  const row = result.rows[0] as {
    notifications_enabled: boolean;
    preferred_theme: UserSettings["preferredTheme"];
    sleep_time: string | null;
    focus_time: string | null;
  };
  return {
    profileId,
    notificationsEnabled: row.notifications_enabled,
    preferredTheme: row.preferred_theme,
    sleepTime: row.sleep_time ? row.sleep_time.slice(0, 5) : undefined,
    focusTime: row.focus_time ? row.focus_time.slice(0, 5) : undefined,
    coins: 0,
  };
}

export async function getUserSettings(profileId: string): Promise<UserSettings | null> {
  const dbProfileId = requireProfileId(profileId);
  const result = await pool.query(
    `select notifications_enabled, preferred_theme, sleep_time, focus_time, coins
     from user_settings where profile_id = $1`,
    [dbProfileId],
  );
  const row = result.rows[0] as
    | {
        notifications_enabled: boolean;
        preferred_theme: UserSettings["preferredTheme"];
        sleep_time: string | null;
        focus_time: string | null;
        coins: number;
      }
    | undefined;
  if (!row) return null;
  return {
    profileId,
    notificationsEnabled: row.notifications_enabled,
    preferredTheme: row.preferred_theme,
    sleepTime: row.sleep_time ? row.sleep_time.slice(0, 5) : undefined,
    focusTime: row.focus_time ? row.focus_time.slice(0, 5) : undefined,
    coins: row.coins ?? 0,
  };
}
