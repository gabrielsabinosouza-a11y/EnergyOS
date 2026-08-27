import pool from "../db";
import type { WeeklyPlan } from "@/types";
import { NotFoundError } from "../errors";
import { ValidationError, parseDate, parseProfileId, parseTitle } from "./validation";
import { assertCategoryForProfile, resolveDefaultCategoryId } from "./categories";

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
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
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

export async function createWeeklyPlan(profileId: string, input: CreateWeeklyPlanInput): Promise<WeeklyPlan> {
  parseProfileId(profileId);
  const title = parseTitle(input.title);
  const planDate = parseDate(input.planDate, "Data do plano");
  const allDay = input.allDay ?? true;
  const categoryId = input.categoryId !== undefined
    ? await assertCategoryForProfile(profileId, input.categoryId)
    : await resolveDefaultCategoryId();

  const inserted = await pool.query<{ id: string | number }>(
    `insert into weekly_plans (profile_id, plan_date, title, category_id, task_id, start_time, end_time, all_day)
     values ($1, $2::date, $3, $4, $5, $6, $7, $8)
     returning id`,
    [profileId, planDate, title, categoryId, input.taskId ?? null, input.startTime ?? null, input.endTime ?? null, allDay],
  );
  const result = await pool.query<WeeklyPlanRow>(`${PLAN_SELECT} where w.id = $1`, [inserted.rows[0].id]);
  return mapPlan(result.rows[0]);
}

export async function completeWeeklyPlan(profileId: string, planId: number): Promise<WeeklyPlan> {
  parseProfileId(profileId);
  if (!Number.isInteger(planId) || planId <= 0) throw new ValidationError("Plano inválido.");
  const updated = await pool.query<{ id: string | number }>(
    `update weekly_plans set completed_at = now()
     where profile_id = $1 and id = $2 and completed_at is null
     returning id`,
    [profileId, planId],
  );
  if (!updated.rows[0]) throw new NotFoundError("Plano não encontrado ou já concluído.");
  const result = await pool.query<WeeklyPlanRow>(`${PLAN_SELECT} where w.id = $1`, [updated.rows[0].id]);
  return mapPlan(result.rows[0]);
}

export async function deleteWeeklyPlan(profileId: string, planId: number): Promise<void> {
  parseProfileId(profileId);
  if (!Number.isInteger(planId) || planId <= 0) throw new ValidationError("Plano inválido.");
  const result = await pool.query(`delete from weekly_plans where profile_id = $1 and id = $2`, [profileId, planId]);
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Plano não encontrado.");
}
