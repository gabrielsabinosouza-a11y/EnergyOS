import type { PoolClient } from "pg";
import type { Goal } from "@/types";
import pool, {
  GOAL_SELECT,
  mapGoalRow,
  withGoalProgress,
  type DbGoalRow,
  type GoalWithProgress,
} from "../db";
import { NotFoundError } from "../errors";
import { parseDate, parseEnum, parseNumber, parseProfileId, ValidationError } from "./validation";
import { dayInTz, goalPeriodKey, goalPeriodRange, todayIso, type DateRange } from "./dates";
import { creditXP } from "./xp";
import { addCoins } from "./settings";
import { recordMissionProgress } from "./daily-quests";
import { addLeagueXP, recomputeWeeklyLeagueXP } from "./league-new";

/**
 * goal_logs — check-ins por dia (o "goalLogs" do briefing).
 *
 * Modelo: a conclusão de uma meta NÃO é um flag permanente. Cada check-in é
 * uma linha `(profile_id, goal_id, log_date, amount)`. O progresso do período
 * ATUAL é derivado por soma:
 *   - daily:   logs só de hoje
 *   - weekly:  semana atual (segunda → domingo)
 *   - monthly: mês atual
 *   - unique:  todos os logs, para sempre
 * `unique (goal_id, log_date)` é o equivalente ao doc id determinístico
 * `goalId_date` pedido no briefing: um registro por meta por dia.
 *
 * Recompensas (XP/moedas) são concedidas apenas na TRANSIÇÃO
 * não-concluída → concluída de um período e ESTORNADAS ao desfazer, com
 * idempotência garantida por `xp_ledger (profile_id, source, source_id)` com
 * `source_id = "<goalId>:<período>"` (ex.: "12:d:2026-04-10").
 */

export interface GoalLogEntry {
  goalId: number;
  date: string;
  amount: number;
}

export const GOAL_LOG_ACTIONS = ["set", "increment", "decrement", "toggle", "uncheck"] as const;
export type GoalLogAction = (typeof GOAL_LOG_ACTIONS)[number];

export interface ApplyGoalLogInput {
  action: GoalLogAction;
  /** YYYY-MM-DD no fuso oficial; default = hoje. Nunca aceita datas futuras. */
  date?: string;
  /** Para action "set": valor absoluto do dia (0 remove o registro). */
  amount?: number;
}

export interface ApplyGoalLogResult {
  goal: GoalWithProgress;
  log: GoalLogEntry | null;
  xpAwarded: number;
  coinsAwarded: number;
  revertedXp: number;
  revertedCoins: number;
}

/**
 * Recompensa de conclusão da meta. Metas não têm mais frequência: TODAS são
 * concluídas UMA vez, no máximo, quando current >= target. A chave de período é
 * sempre "u:once", o que torna o source_id (`<goalId>:u:once`) determinístico e
 * a gravação no xp_ledger naturalmente idempotente.
 */
export const GOAL_COMPLETE_REWARD = { coins: 50, xp: 50 } as const;

/** Recompensa de conclusão (mesma para qualquer meta, pago uma única vez). */
export function goalCompletionReward(): { xp: number; coins: number } {
  return GOAL_COMPLETE_REWARD;
}

/** Id determinístico da recompensa: uma meta só pode pagar uma vez (`12:u:once`). */
export function goalRewardSourceKey(goalId: number, frequency: Goal["frequency"], dateKey: string): string {
  return `${goalId}:${goalPeriodKey(frequency, dateKey)}`;
}

// ── Schema (lazy, idempotente, uma vez por processo) ─────────────────────────

let goalLogsSchemaReady: Promise<void> | null = null;

export function ensureGoalLogsSchema(): Promise<void> {
  goalLogsSchemaReady ??= (async () => {
    await pool.query(`
      create table if not exists goal_logs (
        id bigserial primary key,
        profile_id text not null references profiles(id) on delete cascade,
        goal_id bigint not null references goals(id) on delete cascade,
        log_date date not null,
        amount numeric(8,2) not null default 1 check (amount >= 0),
        created_at timestamptz not null default now(),
        unique (goal_id, log_date)
      )
    `);
    await pool.query(
      `create index if not exists goal_logs_profile_date_idx on goal_logs(profile_id, log_date)`,
    );
  })().catch((error) => {
    // Falha transitória (ex.: banco indisponível) não deve envenenar o
    // processo: a próxima chamada tenta de novo.
    goalLogsSchemaReady = null;
    throw error;
  });
  return goalLogsSchemaReady;
}

type Db = Pick<PoolClient, "query">;

function assertGoalId(goalId: number): void {
  if (!Number.isInteger(goalId) || goalId <= 0) throw new ValidationError("Meta inválida.");
}

async function sumGoalLogs(db: Db, profileId: string, goalId: number, range: DateRange | null): Promise<number> {
  const result = range
    ? await db.query<{ total: string | number }>(
        `select coalesce(sum(amount), 0) as total from goal_logs
         where profile_id = $1 and goal_id = $2 and log_date >= $3::date and log_date <= $4::date`,
        [profileId, goalId, range.start, range.end],
      )
    : await db.query<{ total: string | number }>(
        `select coalesce(sum(amount), 0) as total from goal_logs
         where profile_id = $1 and goal_id = $2`,
        [profileId, goalId],
      );
  return Number(result.rows[0]?.total ?? 0);
}

async function dayAmount(db: Db, profileId: string, goalId: number, date: string): Promise<number> {
  const result = await db.query<{ amount: string | number }>(
    `select amount from goal_logs where profile_id = $1 and goal_id = $2 and log_date = $3::date`,
    [profileId, goalId, date],
  );
  return Number(result.rows[0]?.amount ?? 0);
}

/** Log mais recente (com amount > 0) dentro da janela do período. */
async function latestLogInPeriod(
  db: Db,
  profileId: string,
  goalId: number,
  range: DateRange | null,
): Promise<{ date: string; amount: number } | null> {
  const result = range
    ? await db.query<{ date: string; amount: string | number }>(
        `select log_date::text as date, amount from goal_logs
         where profile_id = $1 and goal_id = $2 and amount > 0
           and log_date >= $3::date and log_date <= $4::date
         order by log_date desc limit 1`,
        [profileId, goalId, range.start, range.end],
      )
    : await db.query<{ date: string; amount: string | number }>(
        `select log_date::text as date, amount from goal_logs
         where profile_id = $1 and goal_id = $2 and amount > 0
         order by log_date desc limit 1`,
        [profileId, goalId],
      );
  const row = result.rows[0];
  return row ? { date: row.date, amount: Number(row.amount) } : null;
}

// ── Leitura ──────────────────────────────────────────────────────────────────

/** Logs dentro de um intervalo de datas (para histórico/heatmap e GET da API). */
export async function listGoalLogsInRange(profileId: string, from: string, to: string): Promise<GoalLogEntry[]> {
  parseProfileId(profileId);
  const fromDate = parseDate(from, "Data inicial");
  const toDate = parseDate(to, "Data final");
  if (fromDate > toDate) throw new ValidationError("Intervalo de datas inválido.");
  await ensureGoalLogsSchema();
  const result = await pool.query<{ goal_id: string | number; date: string; amount: string | number }>(
    `select goal_id, log_date::text as date, amount from goal_logs
     where profile_id = $1 and log_date >= $2::date and log_date <= $3::date
     order by log_date, goal_id`,
    [profileId, fromDate, toDate],
  );
  return result.rows.map((row) => ({ goalId: Number(row.goal_id), date: row.date, amount: Number(row.amount) }));
}

/**
 * Progresso (soma do período) de várias metas de uma vez, com UMA query.
 * Retorna Map<goalId, soma>. Usado por listGoals para nunca devolver o
 * `current_value` legado.
 */
export async function computeGoalPeriodSums(
  profileId: string,
  goals: Goal[],
  referenceDate: string,
): Promise<Map<number, number>> {
  const sums = new Map<number, number>();
  if (goals.length === 0) return sums;
  await ensureGoalLogsSchema();

  const ranges = new Map<number, DateRange | null>();
  for (const goal of goals) ranges.set(goal.id, goalPeriodRange(goal.frequency, referenceDate));

  const needsAllHistory = [...ranges.values()].some((range) => range === null);
  const lowerBound = needsAllHistory
    ? null
    : [...ranges.values()].reduce<string>(
        (min, range) => (range && range.start < min ? range.start : min),
        "9999-12-31",
      );

  const result = lowerBound
    ? await pool.query<{ goal_id: string | number; date: string; amount: string | number }>(
        `select goal_id, log_date::text as date, amount from goal_logs
         where profile_id = $1 and log_date >= $2::date and amount > 0`,
        [profileId, lowerBound],
      )
    : await pool.query<{ goal_id: string | number; date: string; amount: string | number }>(
        `select goal_id, log_date::text as date, amount from goal_logs
         where profile_id = $1 and amount > 0`,
        [profileId],
      );

  for (const goal of goals) {
    const range = ranges.get(goal.id) ?? null;
    let total = 0;
    for (const row of result.rows) {
      if (Number(row.goal_id) !== goal.id) continue;
      if (range && (row.date < range.start || row.date > range.end)) continue;
      total += Number(row.amount);
    }
    sums.set(goal.id, total);
  }
  return sums;
}

/**
 * Soma do período de UMA meta usando a conexão informada — client para
 * leituras DENTRO de uma transação (updateGoal/check-in), pool fora dela.
 */
export async function getGoalPeriodSum(
  db: Pick<PoolClient, "query">,
  profileId: string,
  goal: Pick<Goal, "id" | "frequency">,
  referenceDate: string,
): Promise<number> {
  return sumGoalLogs(db, profileId, goal.id, goalPeriodRange(goal.frequency, referenceDate));
}

/** Meta única com progresso derivado dos logs do período atual. */
export async function getGoalWithLogs(
  profileId: string,
  goalId: number,
  referenceDate: string = todayIso(),
): Promise<GoalWithProgress> {
  parseProfileId(profileId);
  assertGoalId(goalId);
  await ensureGoalLogsSchema();
  const result = await pool.query<DbGoalRow>(
    `${GOAL_SELECT} where g.profile_id = $1 and g.id = $2`,
    [profileId, goalId],
  );
  if (!result.rows[0]) throw new NotFoundError("Meta não encontrada.");
  const goal = mapGoalRow(result.rows[0]);
  const sum = await sumGoalLogs(pool, profileId, goalId, goalPeriodRange(goal.frequency, referenceDate));
  return withGoalProgress(goal, sum);
}

// ── Recompensas (transacionais; reuso por goals.ts ao mudar targetValue) ─────

/**
 * Concede XP+moedas ao concluir um período. Idempotente: o xp_ledger tem
 * unique (profile_id, source, source_id) — chamar de novo no mesmo período
 * (mesmo sourceKey) não paga nada. Roda DENTRO da transação do chamador; o XP
 * de liga é aplicado depois do commit (addLeagueXP usa conexões próprias).
 */
export async function awardGoalCompletion(
  db: PoolClient,
  profileId: string,
  goal: Goal,
  sourceKey: string,
): Promise<{ xpAwarded: number; coinsAwarded: number }> {
  const { xp, coins } = goalCompletionReward();
  const xpAwarded = await creditXP(profileId, "goal", sourceKey, xp, { db });
  let coinsAwarded = 0;
  if (xpAwarded > 0) {
    await addCoins(profileId, coins, db);
    coinsAwarded = coins;
  }
  return { xpAwarded, coinsAwarded };
}

/**
 * Estorna a recompensa de um período (desfazer check-in / subir o alvo):
 * remove a linha do ledger, subtrai o XP exato creditado (com boost), subtrai
 * as moedas (sem ficar negativo) e recua a missão XP_EARNED do dia do crédito
 * (somente se for HOJE — dias passados não são recalculados retroativamente).
 * O XP de liga é recalculado pelo chamador após o commit.
 */
export async function revertGoalCompletion(
  db: PoolClient,
  profileId: string,
  goal: Goal,
  sourceKey: string,
  todayKey: string,
): Promise<{ revertedXp: number; revertedCoins: number }> {
  const ledger = await db.query<{ xp_amount: string | number; created_at: Date | string }>(
    `delete from xp_ledger
     where profile_id = $1 and source = 'goal' and source_id = $2
     returning xp_amount, created_at`,
    [profileId, sourceKey],
  );
  if (!ledger.rows[0]) return { revertedXp: 0, revertedCoins: 0 };

  const xp = Number(ledger.rows[0].xp_amount);
  await db.query(
    `update user_xp set total_xp = greatest(0, total_xp - $2), updated_at = now() where profile_id = $1`,
    [profileId, xp],
  );
  const { coins } = goalCompletionReward();
  await db.query(
    `update user_settings set coins = greatest(0, coins - $2) where profile_id = $1`,
    [profileId, coins],
  );

  const creditDay = dayInTz(ledger.rows[0].created_at);
  if (creditDay === todayKey) {
    await recordMissionProgress(profileId, "XP_EARNED", {
      incrementBy: -xp,
      questDate: todayKey,
      client: db,
    });
  }
  return { revertedXp: xp, revertedCoins: coins };
}

// ── Escrita (ação do card / modal / painel do dia) ───────────────────────────

async function applyOnClient(
  client: PoolClient,
  profileId: string,
  goalId: number,
  input: ApplyGoalLogInput,
  today: string,
): Promise<ApplyGoalLogResult> {
  const date = input.date === undefined ? today : parseDate(input.date, "Data");
  if (date > today) {
    throw new ValidationError("Não é possível registrar progresso em datas futuras.");
  }
  const amount = input.amount === undefined
    ? 1
    : parseNumber(input.amount, "Quantidade", { min: 0, max: 1_000_000 });

  await client.query("begin");
  try {
    // Meta travada na transação — evita corrida entre dois toggles simultâneos
    // (duplo clique / duas abas) gerar recompensa duplicada.
    const goalRow = await client.query<DbGoalRow>(
      `${GOAL_SELECT} where g.profile_id = $1 and g.id = $2 for update of g`,
      [profileId, goalId],
    );
    if (!goalRow.rows[0]) throw new NotFoundError("Meta não encontrada.");
    const goal = mapGoalRow(goalRow.rows[0]);

    const range = goalPeriodRange(goal.frequency, date);
    const beforeSum = await sumGoalLogs(client, profileId, goalId, range);
    const wasDone = goal.targetValue > 0 && beforeSum >= goal.targetValue;

    // Incrementar uma meta já concluída no período é no-op (eco do card).
    if (input.action === "increment" && wasDone) {
      await client.query("commit");
      const goalWithProgress = await getGoalWithLogs(profileId, goalId);
      return { goal: goalWithProgress, log: null, xpAwarded: 0, coinsAwarded: 0, revertedXp: 0, revertedCoins: 0 };
    }

    // Resolve a linha-alvo da escrita.
    let targetDate = date;
    let dayValue = await dayAmount(client, profileId, goalId, date);
    let nextAmount = dayValue;

    const takeFromLatest = async (): Promise<void> => {
      if (dayValue > 0) {
        nextAmount = dayValue - 1;
        return;
      }
      const latest = await latestLogInPeriod(client, profileId, goalId, range);
      if (latest) {
        targetDate = latest.date;
        nextAmount = latest.amount - 1;
      } else {
        nextAmount = 0;
      }
    };

    switch (input.action) {
      case "set":
        nextAmount = amount;
        break;
      case "increment":
        nextAmount = dayValue + 1;
        break;
      case "decrement":
        await takeFromLatest();
        break;
      case "toggle":
        // Metas de quantidade 1: marca/desmarca o período inteiro.
        if (wasDone) {
          await takeFromLatest();
        } else {
          targetDate = date;
          dayValue = await dayAmount(client, profileId, goalId, date);
          nextAmount = Math.max(1, dayValue);
        }
        break;
      case "uncheck":
        await takeFromLatest();
        break;
    }

    let log: GoalLogEntry | null;
    if (nextAmount <= 0) {
      await client.query(
        `delete from goal_logs where profile_id = $1 and goal_id = $2 and log_date = $3::date`,
        [profileId, goalId, targetDate],
      );
      log = null;
    } else {
      const written = await client.query<{ date: string; amount: string | number }>(
        `insert into goal_logs (profile_id, goal_id, log_date, amount)
         values ($1, $2, $3::date, $4)
         on conflict (goal_id, log_date) do update set amount = excluded.amount
         returning log_date::text as date, amount`,
        [profileId, goalId, targetDate, nextAmount],
      );
      log = { goalId, date: written.rows[0].date, amount: Number(written.rows[0].amount) };
    }

    const afterSum = await sumGoalLogs(client, profileId, goalId, range);
    const nowDone = goal.targetValue > 0 && afterSum >= goal.targetValue;

    let xpAwarded = 0;
    let coinsAwarded = 0;
    let revertedXp = 0;
    let revertedCoins = 0;

    const sourceKey = goalRewardSourceKey(goal.id, goal.frequency, date);
    if (!wasDone && nowDone) {
      ({ xpAwarded, coinsAwarded } = await awardGoalCompletion(client, profileId, goal, sourceKey));
    } else if (wasDone && !nowDone) {
      ({ revertedXp, revertedCoins } = await revertGoalCompletion(client, profileId, goal, sourceKey, today));
    }

    await client.query("commit");

    // Pós-commit: liga (usa conexões próprias; fora da transação).
    if (xpAwarded > 0) await addLeagueXP(profileId, xpAwarded);
    if (revertedXp > 0) await recomputeWeeklyLeagueXP(profileId);

    const goalWithProgress = await getGoalWithLogs(profileId, goalId);
    return { goal: goalWithProgress, log, xpAwarded, coinsAwarded, revertedXp, revertedCoins };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  }
}

/** Aplica um check-in (cria/atualiza/remove o log do dia) com recompensas. */
export async function applyGoalLogAction(
  profileId: string,
  goalId: number,
  input: ApplyGoalLogInput,
): Promise<ApplyGoalLogResult> {
  parseProfileId(profileId);
  assertGoalId(goalId);
  const action = parseEnum(input.action, GOAL_LOG_ACTIONS, "Ação");
  await ensureGoalLogsSchema();

  const client = await pool.connect();
  try {
    return await applyOnClient(client, profileId, goalId, { ...input, action }, todayIso());
  } finally {
    client.release();
  }
}
