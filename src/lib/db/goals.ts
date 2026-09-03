import pool, { mapGoalRow, type DbGoalRow } from "../db";
import type { Goal } from "@/types";
import { ensureProfile } from "./profiles";
import { NotFoundError } from "../errors";
import { ValidationError, parseEnum, parseNumber, parseProfileId, parseTitle } from "./validation";
import { assertCategoryForProfile, resolveDefaultCategoryId } from "./categories";
import { awardXPAndCoins, creditXP } from "./xp";
import {
  GOAL_CREATION_XP,
  GOAL_COMPLETION_TIERS,
} from "../daily-limits";

function goalCompletionReward(targetValue: number): { xp: number; coins: number } {
  return GOAL_COMPLETION_TIERS.find((t) => targetValue <= t.maxTarget)
    ?? GOAL_COMPLETION_TIERS[GOAL_COMPLETION_TIERS.length - 1];
}

export const GOAL_FREQUENCY_VALUES = ["daily", "weekly", "monthly"] as const;
export type GoalFrequency = (typeof GOAL_FREQUENCY_VALUES)[number];

/** Colunas de goal + categoria resolvida (join com categories). */
export const GOAL_SELECT = `
  select g.id, g.profile_id, g.title, g.target_value, g.current_value, g.frequency, g.created_at,
         c.id as category_id, c.user_id as category_user_id, c.name as category_name,
         c.color as category_color, c.icon as category_icon, c.is_custom as category_is_custom,
         c.created_at as category_created_at
  from goals g
  join categories c on c.id = g.category_id`;

function assertGoalId(goalId: number): void {
  if (!Number.isInteger(goalId) || goalId <= 0) throw new ValidationError("Meta inválida.");
}

/** Progresso de meta calculado no backend (0–100), nunca confiado ao frontend. */
export function goalProgressPercentage(goal: Goal): number {
  if (goal.targetValue <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100)));
}

export interface GoalWithProgress extends Goal {
  progressPercentage: number;
}

function withProgress(goal: Goal): GoalWithProgress {
  return { ...goal, progressPercentage: goalProgressPercentage(goal) };
}

async function listGoalRows(profileId: string): Promise<DbGoalRow[]> {
  const result = await pool.query<DbGoalRow>(
    `${GOAL_SELECT}
     where g.profile_id = $1
     order by g.created_at desc, g.id desc`,
    [profileId],
  );
  return result.rows;
}

export async function listGoals(profileId: string): Promise<GoalWithProgress[]> {
  parseProfileId(profileId);
  return (await listGoalRows(profileId)).map((row) => withProgress(mapGoalRow(row)));
}

export async function getGoal(profileId: string, goalId: number): Promise<Goal> {
  parseProfileId(profileId);
  assertGoalId(goalId);
  const result = await pool.query<DbGoalRow>(
    `${GOAL_SELECT}
     where g.profile_id = $1 and g.id = $2`,
    [profileId, goalId],
  );
  if (!result.rows[0]) throw new NotFoundError("Meta não encontrada.");
  return mapGoalRow(result.rows[0]);
}

export interface CreateGoalInput {
  title: string;
  categoryId?: number;
  targetValue: number;
  frequency: GoalFrequency;
}

export async function createGoal(profileId: string, input: CreateGoalInput): Promise<GoalWithProgress> {
  parseProfileId(profileId);
  await ensureProfile(profileId);
  const title = parseTitle(input.title);
  const frequency = parseEnum(input.frequency, GOAL_FREQUENCY_VALUES, "Frequência");
  const targetValue = parseNumber(input.targetValue, "Valor alvo", { min: 0.01, max: 1_000_000 });
  const categoryId = input.categoryId !== undefined
    ? await assertCategoryForProfile(profileId, input.categoryId)
    : await resolveDefaultCategoryId();

  const inserted = await pool.query<{ id: string | number }>(
    `insert into goals (profile_id, title, category_id, target_value, frequency)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [profileId, title, categoryId, targetValue, frequency],
  );
  const result = await pool.query<DbGoalRow>(`${GOAL_SELECT} where g.id = $1`, [inserted.rows[0].id]);
  const goal = withProgress(mapGoalRow(result.rows[0]));

  // Award creation XP (idempotent: skip if already credited for this goal)
  const alreadyCredited = await pool.query(
    `select 1 from xp_ledger where profile_id = $1 and source = 'goal' and source_id = $2`,
    [profileId, goal.id],
  );
  if (!alreadyCredited.rows[0]) {
    await creditXP(profileId, "goal", goal.id, GOAL_CREATION_XP);
  }

  return goal;
}

export interface UpdateGoalPatch {
  title?: string;
  categoryId?: number;
  targetValue?: number;
  currentValue?: number;
  frequency?: GoalFrequency;
}

export async function updateGoal(profileId: string, goalId: number, patch: UpdateGoalPatch): Promise<GoalWithProgress> {
  parseProfileId(profileId);
  assertGoalId(goalId);

  // Capture the previous state so we only award on first completion.
  const before = await pool.query<DbGoalRow>(`${GOAL_SELECT} where g.profile_id = $1 and g.id = $2`, [profileId, goalId]);
  if (!before.rows[0]) throw new NotFoundError("Meta não encontrada.");
  const prevGoal = mapGoalRow(before.rows[0]);
  const wasComplete = prevGoal.targetValue > 0 && prevGoal.currentValue >= prevGoal.targetValue;

  const updates: string[] = [];
  const values: (string | number)[] = [profileId, goalId];

  if (patch.title !== undefined) {
    values.push(parseTitle(patch.title));
    updates.push(`title = $${values.length}`);
  }
  if (patch.categoryId !== undefined) {
    const categoryId = await assertCategoryForProfile(profileId, patch.categoryId);
    values.push(categoryId);
    updates.push(`category_id = $${values.length}`);
  }
  if (patch.frequency !== undefined) {
    values.push(parseEnum(patch.frequency, GOAL_FREQUENCY_VALUES, "Frequência"));
    updates.push(`frequency = $${values.length}`);
  }
  if (patch.targetValue !== undefined) {
    values.push(parseNumber(patch.targetValue, "Valor alvo", { min: 0.01, max: 1_000_000 }));
    updates.push(`target_value = $${values.length}`);
  }
  if (patch.currentValue !== undefined) {
    values.push(parseNumber(patch.currentValue, "Progresso atual", { min: 0, max: 1_000_000 }));
    updates.push(`current_value = $${values.length}`);
  }
  if (updates.length === 0) throw new ValidationError("Nenhum campo para atualizar.");

  const updated = await pool.query<{ id: string | number }>(
    `update goals set ${updates.join(", ")}
     where profile_id = $1 and id = $2
     returning id`,
    values,
  );
  if (!updated.rows[0]) throw new NotFoundError("Meta não encontrada.");
  const result = await pool.query<DbGoalRow>(`${GOAL_SELECT} where g.id = $1`, [updated.rows[0].id]);
  const goal = withProgress(mapGoalRow(result.rows[0]));

  // Award once when the goal reaches its target for the first time.
  const nowComplete = goal.targetValue > 0 && goal.currentValue >= goal.targetValue;
  if (nowComplete && !wasComplete) {
    const { xp, coins } = goalCompletionReward(goal.targetValue);
    await awardXPAndCoins(profileId, "goal", goal.id, xp, coins);
  }

  return goal;
}

/** Atualiza apenas o progresso atual da meta (valor acumulado). */
export async function updateGoalProgress(profileId: string, goalId: number, currentValue: number): Promise<GoalWithProgress> {
  return updateGoal(profileId, goalId, { currentValue });
}

export async function deleteGoal(profileId: string, goalId: number): Promise<void> {
  parseProfileId(profileId);
  assertGoalId(goalId);
  const result = await pool.query(`delete from goals where profile_id = $1 and id = $2`, [profileId, goalId]);
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Meta não encontrada.");
}
