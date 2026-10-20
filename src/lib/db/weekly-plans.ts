import pool from "../db";
import type { WeeklyPlan } from "@/types";
import { NotFoundError } from "../errors";
import { ValidationError, parseDate, parseProfileId, parseTitle } from "./validation";
import { assertCategoryForProfile, resolveDefaultCategoryId } from "./categories";
import { PLAN_NAME_MAX } from "../daily-limits";
import { grantPlannerCompletionReward, updatePlannerLeagueXP, type PlannerRewardResult } from "./planner-rewards";

/** Colunas de weekly_plan + categoria resolvida (join com categories). */
const PLAN_SELECT = `
  select w.id, w.profile_id, w.plan_date, w.title, w.task_id, w.completed_at, w.created_at,
         w.start_time, w.end_time, w.all_day,
         c.id as category_id, c.user_id as category_user_id, c.name as category_name,
         c.color as category_color, c.icon as category_icon, c.is_custom as category_is_custom,
         c.created_at as category_created_at
  from weekly_plans w
  join categories c on c.id = w.category_id`;

interface WeeklyPlanRow {
  id: string | number;
  profile_id: string;
  plan_date: Date | string;
  title: string;
  task_id: string | number | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  category_id: string | number;
  category_user_id: string | null;
  category_name: string;
  category_color: string;
  category_icon: string | null;
  category_is_custom: boolean;
  category_created_at: Date | string;
}

function mapPlan(row: WeeklyPlanRow): WeeklyPlan {
  const normalizeTime = (time: string | null) => time ? time.slice(0, 5) : undefined;
  return {
    id: Number(row.id),
    profileId: row.profile_id,
    planDate: typeof row.plan_date === "string" ? row.plan_date : row.plan_date.toISOString().slice(0, 10),
    title: row.title,
    categoryId: Number(row.category_id),
    category: {
      id: Number(row.category_id),
      userId: row.category_user_id,
      name: row.category_name,
      color: row.category_color,
      icon: row.category_icon,
      isCustom: row.category_is_custom,
      createdAt: typeof row.category_created_at === "string"
        ? row.category_created_at
        : row.category_created_at.toISOString(),
    },
    taskId: row.task_id ? Number(row.task_id) : undefined,
    completedAt: row.completed_at ? (typeof row.completed_at === "string" ? row.completed_at : row.completed_at.toISOString()) : undefined,
    startTime: normalizeTime(row.start_time),
    endTime: normalizeTime(row.end_time),
    allDay: row.all_day ?? true,
  };
}

export async function listWeeklyPlans(profileId: string, weekStart?: string): Promise<WeeklyPlan[]> {
  parseProfileId(profileId);
  const start = weekStart ?? "";
  if (start) {
    const result = await pool.query<WeeklyPlanRow>(
      `${PLAN_SELECT}
       where w.profile_id = $1 and w.plan_date >= $2::date and w.plan_date < ($2::date + interval '7 days')
       order by w.plan_date, w.id`,
      [profileId, start],
    );
    return result.rows.map(mapPlan);
  }
  const result = await pool.query<WeeklyPlanRow>(
    `${PLAN_SELECT}
     where w.profile_id = $1
     order by w.plan_date desc, w.id
     limit 50`,
    [profileId],
  );
  return result.rows.map(mapPlan);
}

export interface CreateWeeklyPlanInput {
  planDate: string;
  title: string;
  categoryId?: number;
  taskId?: number;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
}

function parsePlanTime(value: unknown, label: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new ValidationError(`${label} inválido.`);
  }
  return value;
}

export async function createWeeklyPlan(profileId: string, input: CreateWeeklyPlanInput): Promise<WeeklyPlan> {
  parseProfileId(profileId);
  const title = parseTitle(input.title);

  // Plan names have a tighter soft limit than parseTitle's generic 200-char
  // maximum. Reject at PLAN_NAME_MAX (120) for consistency with the frontend.
  if (title.length > PLAN_NAME_MAX) {
    throw new ValidationError(`Use até ${PLAN_NAME_MAX} caracteres. Coloque os detalhes na nota.`);
  }

  const planDate = parseDate(input.planDate, "Data do plano");
  const startTime = parsePlanTime(input.startTime, "Horário de início");
  const endTime = parsePlanTime(input.endTime, "Horário de fim");
  if (startTime && endTime && endTime <= startTime) {
    throw new ValidationError("O horário de fim deve ser posterior ao início.");
  }
  const allDay = input.allDay ?? true;
  const categoryId = input.categoryId !== undefined
    ? await assertCategoryForProfile(profileId, input.categoryId)
    : await resolveDefaultCategoryId();

  const inserted = await pool.query<{ id: string | number }>(
    `insert into weekly_plans (profile_id, plan_date, title, category_id, task_id, start_time, end_time, all_day)
     values ($1, $2::date, $3, $4, $5, $6, $7, $8)
     returning id`,
    [profileId, planDate, title, categoryId, input.taskId ?? null, startTime ?? null, endTime ?? null, allDay],
  );
  const result = await pool.query<WeeklyPlanRow>(`${PLAN_SELECT} where w.id = $1`, [inserted.rows[0].id]);
  return mapPlan(result.rows[0]);
}

/** Atualiza a conclusão e concede a recompensa no mesmo commit. */
export async function setWeeklyPlanCompleted(
  profileId: string,
  planId: number,
  completed: boolean,
): Promise<{ plan: WeeklyPlan } & PlannerRewardResult> {
  parseProfileId(profileId);
  if (!Number.isInteger(planId) || planId <= 0) throw new ValidationError("Plano inválido.");
  const client = await pool.connect();
  let reward: PlannerRewardResult = { xpAwarded: 0, coinsAwarded: 0 };
  let plan: WeeklyPlan;
  try {
    await client.query("begin");
    const planRow = await client.query<{ id: string | number }>(
      `select id from weekly_plans where id = $1 and profile_id = $2 for update`,
      [planId, profileId],
    );
    if (!planRow.rows[0]) throw new NotFoundError("Plano não encontrado.");

    await client.query(
      `update weekly_plans set completed_at = ${completed ? "now()" : "null"}
       where profile_id = $1 and id = $2`,
      [profileId, planId],
    );
    reward = await grantPlannerCompletionReward(profileId, "weekly_plan", planId, completed, client);
    const result = await client.query<WeeklyPlanRow>(
      `${PLAN_SELECT} where w.profile_id = $1 and w.id = $2`,
      [profileId, planId],
    );
    plan = mapPlan(result.rows[0]);
    await client.query("commit");
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  await updatePlannerLeagueXP(profileId, reward.xpAwarded);
  return { plan, ...reward };
}

export interface UpdateWeeklyPlanInput {
  title?: string;
  categoryId?: number;
  planDate?: string;
  startTime?: string | null;
  endTime?: string | null;
}

/** Edita os campos de um plano independente. */
export async function updateWeeklyPlan(profileId: string, planId: number, input: UpdateWeeklyPlanInput): Promise<WeeklyPlan> {
  parseProfileId(profileId);
  if (!Number.isInteger(planId) || planId <= 0) throw new ValidationError("Plano inválido.");
  const title = input.title !== undefined ? parseTitle(input.title) : undefined;
  // Plan names have a tighter soft limit than parseTitle's generic 200-char
  // maximum. Reject at PLAN_NAME_MAX (120) for consistency with the frontend.
  if (title !== undefined && title.length > PLAN_NAME_MAX) {
    throw new ValidationError(`Use até ${PLAN_NAME_MAX} caracteres. Coloque os detalhes na nota.`);
  }
  const planDate = input.planDate !== undefined ? parseDate(input.planDate, "Data do plano") : undefined;
  const categoryId = input.categoryId !== undefined
    ? await assertCategoryForProfile(profileId, input.categoryId)
    : undefined;
  const startTime = parsePlanTime(input.startTime, "Horário de início");
  const endTime = parsePlanTime(input.endTime, "Horário de fim");
  if (startTime && endTime && endTime <= startTime) {
    throw new ValidationError("O horário de fim deve ser posterior ao início.");
  }

  const sets: string[] = [];
  const colValues: unknown[] = [];
  let n = 0;
  const push = (sql: string, val: unknown) => {
    n += 1;
    sets.push(sql.replace("$N", `$${n}`));
    colValues.push(val);
  };
  if (title !== undefined) push("title = $N", title);
  if (planDate !== undefined) push("plan_date = $N::date", planDate);
  if (categoryId !== undefined) push("category_id = $N", categoryId);
  if (startTime !== undefined) push("start_time = $N::time", startTime);
  if (endTime !== undefined) push("end_time = $N::time", endTime);
  if (sets.length === 0) throw new ValidationError("Nada para atualizar.");

  colValues.push(profileId, planId);
  const updated = await pool.query<{ id: string | number }>(
    `update weekly_plans set ${sets.join(", ")}
     where profile_id = $${n + 1} and id = $${n + 2}
     returning id`,
    colValues,
  );
  if (!updated.rows[0]) throw new NotFoundError("Plano não encontrado.");
  const result = await pool.query<WeeklyPlanRow>(`${PLAN_SELECT} where w.id = $1`, [updated.rows[0].id]);
  return mapPlan(result.rows[0]);
}

export async function deleteWeeklyPlan(profileId: string, planId: number): Promise<void> {
  parseProfileId(profileId);
  if (!Number.isInteger(planId) || planId <= 0) throw new ValidationError("Plano inválido.");
  const result = await pool.query(`delete from weekly_plans where profile_id = $1 and id = $2`, [profileId, planId]);
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Plano não encontrado.");
}
