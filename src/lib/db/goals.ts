import pool, {
  GOAL_SELECT,
  goalProgressPercentage,
  mapGoalRow,
  withGoalProgress,
  type DbGoalRow,
  type GoalWithProgress,
} from "../db";
import type { Goal } from "@/types";
import { ensureProfile } from "./profiles";
import { NotFoundError } from "../errors";
import { ValidationError, parseDate, parseEnum, parseNumber, parseProfileId, parseTitle } from "./validation";
import { assertCategoryForProfile, resolveDefaultCategoryId } from "./categories";
import { creditXP } from "./xp";
import { todayIso } from "./dates";
import { addLeagueXP, recomputeWeeklyLeagueXP } from "./league-new";
import { GOAL_CREATION_XP } from "../daily-limits";
import {
  applyGoalLogAction,
  awardGoalCompletion,
  computeGoalPeriodSums,
  getGoalPeriodSum,
  getGoalWithLogs,
  goalRewardSourceKey,
  revertGoalCompletion,
} from "./goal-logs";

/**
 * GOAL_SELECT / GoalWithProgress / goalProgressPercentage vivem em `../db`
 * (compartilhados com goal-logs.ts para evitar import circular), mas seguem
 * re-exportados daqui para os importers históricos (api-client, goals-service).
 */
export { GOAL_SELECT, goalProgressPercentage };
export type { GoalWithProgress };

export const GOAL_FREQUENCY_VALUES = ["daily", "weekly", "monthly", "unique"] as const;
export type GoalFrequency = (typeof GOAL_FREQUENCY_VALUES)[number];

function assertGoalId(goalId: number): void {
  if (!Number.isInteger(goalId) || goalId <= 0) throw new ValidationError("Meta inválida.");
}

/**
 * Monta o GoalWithProgress a partir do progresso DERIVADO (goal_logs).
 * `derivedCurrentValue` é o somatório do período atual; quando omitido usa o
 * valor da linha — só acontece em meta recém-criada, sempre 0.
 */
function withProgress(goal: Goal, derivedCurrentValue?: number): GoalWithProgress {
  return withGoalProgress(goal, derivedCurrentValue);
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

/**
 * Metas com progresso derivado dos logs do período atual. NUNCA usa a coluna
 * legada `current_value` (congelada): uma meta diária concluída ontem volta a
 * 0/1 hoje — o bug de "Concluída para sempre" morre aqui.
 */
export async function listGoals(profileId: string): Promise<GoalWithProgress[]> {
  parseProfileId(profileId);
  await ensureGoalsSchema();
  const goals = (await listGoalRows(profileId)).map(mapGoalRow);
  const sums = await computeGoalPeriodSums(profileId, goals, todayIso());
  return goals.map((goal) => withProgress(goal, sums.get(goal.id) ?? 0));
}

export async function getGoal(profileId: string, goalId: number): Promise<GoalWithProgress> {
  parseProfileId(profileId);
  assertGoalId(goalId);
  await ensureGoalsSchema();
  const result = await pool.query<DbGoalRow>(
    `${GOAL_SELECT}
     where g.profile_id = $1 and g.id = $2`,
    [profileId, goalId],
  );
  if (!result.rows[0]) throw new NotFoundError("Meta não encontrada.");
  const goal = mapGoalRow(result.rows[0]);
  const sum = await getGoalPeriodSum(pool, profileId, goal, todayIso());
  return withProgress(goal, sum);
}

export interface CreateGoalInput {
  title: string;
  categoryId?: number;
  targetValue: number;
  /** Unidade livre opcional ("livros", "horas"...). */
  unit?: string | null;
  /** Prazo opcional (YYYY-MM-DD). */
  deadline?: string | null;
}

/**
 * Garante as colunas novas da meta (unidade/prazo/conclusão). Idempotente e
 * executada uma vez por processo, no mesmo espírito do ensureGoalLogsSchema —
 * o app funciona antes/depois da migração sem depender de ordem de deploy.
 */
let goalsSchemaReady: Promise<void> | null = null;

export function ensureGoalsSchema(): Promise<void> {
  goalsSchemaReady ??= (async () => {
    await pool.query(`alter table goals add column if not exists unit text`);
    await pool.query(`alter table goals add column if not exists deadline date`);
    await pool.query(`alter table goals add column if not exists completed_at timestamptz`);
    await pool.query(`create index if not exists goals_profile_deadline_idx on goals(profile_id, deadline)`);
  })().catch((error) => {
    goalsSchemaReady = null;
    throw error;
  });
  return goalsSchemaReady;
}

/** Unidade livre: até 24 caracteres, sem espaços nas pontas. "" = sem unidade. */
function parseUnit(unit: string | null | undefined): string | null {
  if (unit === undefined || unit === null) return null;
  const value = String(unit).trim();
  if (value === "") return null;
  if (value.length > 24) throw new ValidationError("Unidade muito longa (máx. 24).");
  return value;
}

export async function createGoal(profileId: string, input: CreateGoalInput): Promise<GoalWithProgress> {
  parseProfileId(profileId);
  await ensureGoalsSchema();
  await ensureProfile(profileId);
  const title = parseTitle(input.title);
  const targetValue = parseNumber(input.targetValue, "Valor alvo", { min: 0.01, max: 1_000_000 });
  const unit = parseUnit(input.unit);
  const deadline = input.deadline ? parseDate(input.deadline, "Prazo") : null;
  const categoryId = input.categoryId !== undefined
    ? await assertCategoryForProfile(profileId, input.categoryId)
    : await resolveDefaultCategoryId();

  // `frequency` continua no banco (não apagamos nada), mas nasce como 'unique':
  // meta não tem mais periodicidade.
  const inserted = await pool.query<{ id: string | number }>(
    `insert into goals (profile_id, title, category_id, target_value, frequency, unit, deadline)
     values ($1, $2, $3, $4, 'unique', $5, $6::date)
     returning id`,
    [profileId, title, categoryId, targetValue, unit, deadline],
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
  /** Unidade livre opcional ("" ou null limpa). */
  unit?: string | null;
  /** Prazo opcional (YYYY-MM-DD); null limpa. */
  deadline?: string | null;
}

export interface UpdateGoalResult {
  goal: GoalWithProgress;
  xpAwarded: number;
  coinsAwarded: number;
  revertedXp: number;
  revertedCoins: number;
}

/**
 * Atualiza campos da meta e SINCRONIZA a recompensa do período atual:
 *  - subir o alvo acima do progresso reverte a recompensa já paga neste
 *    período (senão dava para "desconcluir" e re-concluir de graça);
 *  - baixar o alvo até o progresso paga a recompensa normalmente.
 * O XP de liga é recalculado após o commit.
 */
export async function updateGoal(
  profileId: string,
  goalId: number,
  patch: UpdateGoalPatch,
): Promise<UpdateGoalResult> {
  parseProfileId(profileId);
  assertGoalId(goalId);
  await ensureGoalsSchema();

  const client = await pool.connect();
  try {
    await client.query("begin");

    // Estado anterior + lock da meta (progresso vem dos logs, nunca da
    // coluna legada current_value).
    const before = await client.query<DbGoalRow>(
      `${GOAL_SELECT} where g.profile_id = $1 and g.id = $2 for update of g`,
      [profileId, goalId],
    );
    if (!before.rows[0]) throw new NotFoundError("Meta não encontrada.");
    const prevGoal = mapGoalRow(before.rows[0]);
    const today = todayIso();
    const sumBefore = await getGoalPeriodSum(client, profileId, prevGoal, today);
    const wasComplete = prevGoal.targetValue > 0 && sumBefore >= prevGoal.targetValue;

    const updates: string[] = [];
    const values: (string | number | null)[] = [profileId, goalId];

    if (patch.title !== undefined) {
      values.push(parseTitle(patch.title));
      updates.push(`title = $${values.length}`);
    }
    if (patch.categoryId !== undefined) {
      const categoryId = await assertCategoryForProfile(profileId, patch.categoryId);
      values.push(categoryId);
      updates.push(`category_id = $${values.length}`);
    }
    if (patch.unit !== undefined) {
      values.push(parseUnit(patch.unit));
      updates.push(`unit = $${values.length}`);
    }
    if (patch.deadline !== undefined) {
      if (patch.deadline === null) {
        updates.push(`deadline = null`);
      } else {
        values.push(parseDate(patch.deadline, "Prazo"));
        updates.push(`deadline = $${values.length}::date`);
      }
    }
    if (patch.targetValue !== undefined) {
      values.push(parseNumber(patch.targetValue, "Valor alvo", { min: 0.01, max: 1_000_000 }));
      updates.push(`target_value = $${values.length}`);
    }
    if (updates.length === 0) throw new ValidationError("Nenhum campo para atualizar.");

    await client.query(
      `update goals set ${updates.join(", ")}
       where profile_id = $1 and id = $2`,
      values,
    );
    const after = await client.query<DbGoalRow>(`${GOAL_SELECT} where g.id = $1`, [goalId]);
    if (!after.rows[0]) throw new NotFoundError("Meta não encontrada.");
    const goal = mapGoalRow(after.rows[0]);

    // Transição de conclusão do período atual, sempre derivada dos logs.
    const sumAfter = await getGoalPeriodSum(client, profileId, goal, today);
    const nowComplete = goal.targetValue > 0 && sumAfter >= goal.targetValue;

    let xpAwarded = 0;
    let coinsAwarded = 0;
    let revertedXp = 0;
    let revertedCoins = 0;

    // Transição de conclusão: TODA meta paga uma única vez ao atingir o alvo e tem
// a recompensa estornada se voltar abaixo (id determinístico = xp_ledger).
    if (nowComplete && !wasComplete) {
      ({ xpAwarded, coinsAwarded } = await awardGoalCompletion(
        client,
        profileId,
        goal,
        goalRewardSourceKey(goal.id, goal.frequency, today),
      ));
      await client.query(`update goals set completed_at = now() where id = $1`, [goalId]);
    } else if (!nowComplete && wasComplete) {
      ({ revertedXp, revertedCoins } = await revertGoalCompletion(
        client,
        profileId,
        prevGoal,
        goalRewardSourceKey(goal.id, prevGoal.frequency, today),
        today,
      ));
      await client.query(`update goals set completed_at = null where id = $1`, [goalId]);
    }

    await client.query("commit");

    // Pós-commit: liga (conexões próprias; fora da transação).
    if (xpAwarded > 0) await addLeagueXP(profileId, xpAwarded);
    if (revertedXp > 0) await recomputeWeeklyLeagueXP(profileId);

    const goalWithProgress = await getGoalWithLogs(profileId, goalId);
    return { goal: goalWithProgress, xpAwarded, coinsAwarded, revertedXp, revertedCoins };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Compat: ajusta o progresso do DIA ATUAL via check-in ("set"). A API pública
 * é POST /api/goal-logs; este helper existe para chamadas internas legadas.
 */
export async function updateGoalProgress(profileId: string, goalId: number, currentValue: number): Promise<GoalWithProgress> {
  const { goal } = await applyGoalLogAction(profileId, goalId, { action: "set", amount: currentValue });
  return goal;
}

export async function deleteGoal(profileId: string, goalId: number): Promise<void> {
  parseProfileId(profileId);
  assertGoalId(goalId);
  const result = await pool.query(`delete from goals where profile_id = $1 and id = $2`, [profileId, goalId]);
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Meta não encontrada.");
}
