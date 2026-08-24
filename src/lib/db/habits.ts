import pool, { mapHabitRow, type DbHabitRow, type HabitWithCompletion } from "../db";
import { NotFoundError } from "../errors";
import { ValidationError, parseDate, parseEnum, parseProfileId, parseTitle } from "./validation";
import { todayIso } from "./dates";

export const HABIT_FREQUENCY_VALUES = ["daily", "weekly"] as const;
export type HabitFrequency = (typeof HABIT_FREQUENCY_VALUES)[number];

export type { HabitWithCompletion };

function assertHabitId(habitId: number): void {
  if (!Number.isInteger(habitId) || habitId <= 0) throw new ValidationError("Hábito inválido.");
}

async function assertGoalOwnership(profileId: string, goalId: number): Promise<void> {
  const owner = await pool.query(`select 1 from goals where id = $1 and profile_id = $2`, [goalId, profileId]);
  if (!owner.rows[0]) throw new NotFoundError("Meta não encontrada.");
}

async function assertHabitOwnership(profileId: string, habitId: number): Promise<void> {
  const owner = await pool.query(
    `select h.id from habits h join goals g on g.id = h.goal_id where h.id = $1 and g.profile_id = $2`,
    [habitId, profileId],
  );
  if (!owner.rows[0]) throw new NotFoundError("Hábito não encontrado.");
}

/** Lista hábitos do usuário com o estado de conclusão de HOJE decidido pelo servidor. */
export async function listHabits(profileId: string): Promise<HabitWithCompletion[]> {
  parseProfileId(profileId);
  const result = await pool.query<DbHabitRow>(
    `select h.id, h.goal_id, h.title, h.frequency, h.active,
            exists (
              select 1 from habit_completions hc
              where hc.habit_id = h.id and hc.completed_date = $2::date
            ) as completed_today
     from habits h
     join goals g on g.id = h.goal_id
     where g.profile_id = $1
     order by h.active desc, h.id`,
    [profileId, todayIso()],
  );
  return result.rows.map(mapHabitRow);
}

export interface CreateHabitInput {
  goalId: number;
  title: string;
  frequency: HabitFrequency;
}

export async function createHabit(profileId: string, input: CreateHabitInput): Promise<HabitWithCompletion> {
  parseProfileId(profileId);
  await assertGoalOwnership(profileId, input.goalId);
  const title = parseTitle(input.title);
  const frequency = parseEnum(input.frequency, HABIT_FREQUENCY_VALUES, "Frequência");

  const result = await pool.query<DbHabitRow>(
    `insert into habits (goal_id, title, frequency) values ($1, $2, $3)
     returning id, goal_id, title, frequency, active, false as completed_today`,
    [input.goalId, title, frequency],
  );
  return mapHabitRow(result.rows[0]);
}

export interface UpdateHabitPatch {
  title?: string;
  active?: boolean;
  frequency?: HabitFrequency;
}

export async function updateHabit(profileId: string, habitId: number, patch: UpdateHabitPatch): Promise<HabitWithCompletion> {
  parseProfileId(profileId);
  assertHabitId(habitId);

  const updates: string[] = [];
  const values: (string | number | boolean)[] = [habitId];

  if (patch.title !== undefined) {
    values.push(parseTitle(patch.title));
    updates.push(`title = $${values.length}`);
  }
  if (patch.active !== undefined) {
    values.push(patch.active);
    updates.push(`active = $${values.length}`);
  }
  if (patch.frequency !== undefined) {
    values.push(parseEnum(patch.frequency, HABIT_FREQUENCY_VALUES, "Frequência"));
    updates.push(`frequency = $${values.length}`);
  }
  if (updates.length === 0) throw new ValidationError("Nenhum campo para atualizar.");

  await assertHabitOwnership(profileId, habitId);
  const result = await pool.query<DbHabitRow>(
    `update habits set ${updates.join(", ")} where id = $1
     returning id, goal_id, title, frequency, active,
       exists (
         select 1 from habit_completions hc
         where hc.habit_id = habits.id and hc.completed_date = current_date
       ) as completed_today`,
    values,
  );
  return mapHabitRow(result.rows[0]);
}

export async function deleteHabit(profileId: string, habitId: number): Promise<void> {
  parseProfileId(profileId);
  assertHabitId(habitId);
  await assertHabitOwnership(profileId, habitId);
  await pool.query(`delete from habits where id = $1`, [habitId]);
}

/**
 * Marca/desmarca a conclusão do hábito em uma data.
 * A data é resolvida no SERVIDOR quando não informada — o cliente nunca define streak.
 */
export async function setHabitCompletion(
  profileId: string,
  habitId: number,
  completed: boolean,
  date?: string,
): Promise<{ habitId: number; date: string; completed: boolean }> {
  parseProfileId(profileId);
  assertHabitId(habitId);
  const targetDate = date === undefined ? todayIso() : parseDate(date, "Data");
  await assertHabitOwnership(profileId, habitId);

  if (completed) {
    await pool.query(
      `insert into habit_completions (habit_id, profile_id, completed_date)
       values ($1, $2, $3::date)
       on conflict (habit_id, completed_date) do nothing`,
      [habitId, profileId, targetDate],
    );
  } else {
    await pool.query(
      `delete from habit_completions where habit_id = $1 and completed_date = $2::date`,
      [habitId, targetDate],
    );
  }
  return { habitId, date: targetDate, completed };
}
