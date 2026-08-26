import pool from "../db";
import type { WeeklyPlan, TaskCategory } from "@/types";
import { NotFoundError } from "../errors";
import { ValidationError, parseDate, parseEnum, parseProfileId, parseTitle } from "./validation";

const TASK_CATEGORIES: readonly TaskCategory[] = ["FOCO", "CORPO", "MENTE", "ORDEM", "ENERGIA"];

interface WeeklyPlanRow {
  id: string | number;
  profile_id: string;
  plan_date: Date | string;
  title: string;
  category: TaskCategory;
  task_id: string | number | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
}

function mapPlan(row: WeeklyPlanRow): WeeklyPlan {
  return {
    id: Number(row.id),
    profileId: row.profile_id,
    planDate: typeof row.plan_date === "string" ? row.plan_date : row.plan_date.toISOString().slice(0, 10),
    title: row.title,
    category: row.category,
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
      `select id, profile_id, plan_date, title, category, task_id, completed_at, created_at, start_time, end_time, all_day
       from weekly_plans where profile_id = $1 and plan_date >= $2::date and plan_date < ($2::date + interval '7 days')
       order by plan_date, id`,
      [profileId, start],
    );
    return result.rows.map(mapPlan);
  }
  const result = await pool.query<WeeklyPlanRow>(
    `select id, profile_id, plan_date, title, category, task_id, completed_at, created_at, start_time, end_time, all_day
     from weekly_plans where profile_id = $1
     order by plan_date desc, id
     limit 50`,
    [profileId],
  );
  return result.rows.map(mapPlan);
}

export interface CreateWeeklyPlanInput {
  planDate: string;
  title: string;
  category?: TaskCategory;
  taskId?: number;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
}

export async function createWeeklyPlan(profileId: string, input: CreateWeeklyPlanInput): Promise<WeeklyPlan> {
  parseProfileId(profileId);
  const title = parseTitle(input.title);
  const planDate = parseDate(input.planDate, "Data do plano");
  const category = parseEnum(input.category ?? "FOCO", TASK_CATEGORIES, "Categoria");
  const allDay = input.allDay ?? true;

  const result = await pool.query<WeeklyPlanRow>(
    `insert into weekly_plans (profile_id, plan_date, title, category, task_id, start_time, end_time, all_day)
     values ($1, $2::date, $3, $4, $5, $6, $7, $8)
     returning id, profile_id, plan_date, title, category, task_id, completed_at, created_at, start_time, end_time, all_day`,
    [profileId, planDate, title, category, input.taskId ?? null, input.startTime ?? null, input.endTime ?? null, allDay],
  );
  return mapPlan(result.rows[0]);
}

export async function completeWeeklyPlan(profileId: string, planId: number): Promise<WeeklyPlan> {
  parseProfileId(profileId);
  if (!Number.isInteger(planId) || planId <= 0) throw new ValidationError("Plano inválido.");
  const result = await pool.query<WeeklyPlanRow>(
    `update weekly_plans set completed_at = now()
     where profile_id = $1 and id = $2 and completed_at is null
     returning id, profile_id, plan_date, title, category, task_id, completed_at, created_at, start_time, end_time, all_day`,
    [profileId, planId],
  );
  if (!result.rows[0]) throw new NotFoundError("Plano não encontrado ou já concluído.");
  return mapPlan(result.rows[0]);
}

export async function deleteWeeklyPlan(profileId: string, planId: number): Promise<void> {
  parseProfileId(profileId);
  if (!Number.isInteger(planId) || planId <= 0) throw new ValidationError("Plano inválido.");
  const result = await pool.query(`delete from weekly_plans where profile_id = $1 and id = $2`, [profileId, planId]);
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Plano não encontrado.");
}
