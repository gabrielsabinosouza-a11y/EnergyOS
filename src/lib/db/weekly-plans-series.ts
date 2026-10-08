import pool from "../db";
import type { WeeklyPlanSeries, WeeklyPlanItem, PlanRepeatType, PlanEndType, Category } from "@/types";
import { NotFoundError } from "../errors";
import { ValidationError, parseProfileId, parseTitle } from "./validation";
import { assertCategoryForProfile, resolveDefaultCategoryId } from "./categories";
import { WEEKLY_PLAN_SERIES_LIMIT } from "../daily-limits";

// ── Schema ──────────────────────────────────────────────────────────────────────

export async function ensureWeeklyPlanSeriesSchema() {
  await pool.query(`
    create table if not exists weekly_plan_series (
      id              serial primary key,
      profile_id      text not null references profiles(id) on delete cascade,
      title           text not null,
      category_id     int not null references categories(id),
      icon_type       text default 'asset',
      icon_value      text,
      color           text,
      note            text,
      repeat_type     text not null default 'once',
      repeat_days     int[],
      repeat_interval int,
      start_time      time,
      duration_minutes int,
      start_date      date not null,
      end_type        text not null default 'never',
      end_date        date,
      end_count       int,
      timezone        text not null default 'America/Sao_Paulo',
      archived        boolean not null default false,
      created_at      timestamptz not null default now()
    )
  `);
  await pool.query(`
    create table if not exists weekly_plan_occurrences (
      id                 serial primary key,
      series_id          int not null references weekly_plan_series(id) on delete cascade,
      occurrence_date    date not null,
      completed_at       timestamptz,
      skipped            boolean not null default false,
      override_title     text,
      override_start_time time,
      unique (series_id, occurrence_date)
    )
  `);
  await pool.query(`create index if not exists idx_wps_profile on weekly_plan_series(profile_id, archived)`);
  await pool.query(`create index if not exists idx_wpo_series_date on weekly_plan_occurrences(series_id, occurrence_date)`);
}

// ── Query helpers ───────────────────────────────────────────────────────────────

const SERIES_SELECT = `
  select s.id, s.profile_id, s.title, s.category_id, s.icon_type, s.icon_value,
         s.color, s.note, s.repeat_type, s.repeat_days, s.repeat_interval,
         s.start_time, s.duration_minutes, s.start_date, s.end_type, s.end_date,
         s.end_count, s.timezone, s.archived, s.created_at,
         c.id as category_id, c.user_id as category_user_id, c.name as category_name,
         c.color as category_color, c.icon as category_icon, c.is_custom as category_is_custom,
         c.created_at as category_created_at
  from weekly_plan_series s
  join categories c on c.id = s.category_id
`;

interface SeriesRow {
  id: string | number;
  profile_id: string;
  title: string;
  category_id: string | number;
  icon_type: string | null;
  icon_value: string | null;
  color: string | null;
  note: string | null;
  repeat_type: string;
  repeat_days: number[] | null;
  repeat_interval: number | null;
  start_time: string | null;
  duration_minutes: number | null;
  start_date: Date | string;
  end_type: string;
  end_date: Date | string | null;
  end_count: number | null;
  timezone: string;
  archived: boolean;
  created_at: Date | string;
  category_user_id: string | null;
  category_name: string;
  category_color: string;
  category_icon: string | null;
  category_is_custom: boolean;
  category_created_at: Date | string;
}

function mapCategory(row: SeriesRow): Category {
  return {
    id: Number(row.category_id),
    userId: row.category_user_id,
    name: row.category_name,
    color: row.category_color,
    icon: row.category_icon,
    isCustom: row.category_is_custom,
    createdAt: typeof row.category_created_at === "string"
      ? row.category_created_at
      : row.category_created_at.toISOString(),
  };
}

function mapSeries(row: SeriesRow): WeeklyPlanSeries {
  return {
    id: Number(row.id),
    profileId: row.profile_id,
    title: row.title,
    categoryId: Number(row.category_id),
    category: mapCategory(row),
    iconType: row.icon_type as "asset" | "emoji" | "image" | null,
    iconValue: row.icon_value,
    color: row.color,
    note: row.note,
    repeatType: row.repeat_type as PlanRepeatType,
    repeatDays: row.repeat_days,
    repeatInterval: row.repeat_interval,
    startTime: row.start_time,
    durationMinutes: row.duration_minutes,
    startDate: typeof row.start_date === "string" ? row.start_date : row.start_date.toISOString().slice(0, 10),
    endType: row.end_type as PlanEndType,
    endDate: row.end_date ? (typeof row.end_date === "string" ? row.end_date : row.end_date.toISOString().slice(0, 10)) : null,
    endCount: row.end_count,
    timezone: row.timezone,
    archived: row.archived,
    createdAt: typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString(),
  };
}

// ── CRUD ────────────────────────────────────────────────────────────────────────

export async function listWeeklyPlanSeries(profileId: string): Promise<WeeklyPlanSeries[]> {
  parseProfileId(profileId);
  const result = await pool.query<SeriesRow>(
    `${SERIES_SELECT} where s.profile_id = $1 and s.archived = false order by s.created_at desc`,
    [profileId],
  );
  return result.rows.map(mapSeries);
}

export interface CreateWeeklyPlanSeriesInput {
  title: string;
  categoryId?: number;
  iconType?: "asset" | "emoji" | "image" | null;
  iconValue?: string | null;
  color?: string | null;
  note?: string | null;
  repeatType: PlanRepeatType;
  repeatDays?: number[] | null;
  repeatInterval?: number | null;
  startTime?: string | null;
  durationMinutes?: number | null;
  startDate: string;
  endType?: PlanEndType;
  endDate?: string | null;
  endCount?: number | null;
  timezone?: string;
}

export async function createWeeklyPlanSeries(
  profileId: string,
  input: CreateWeeklyPlanSeriesInput,
): Promise<WeeklyPlanSeries> {
  parseProfileId(profileId);
  const title = parseTitle(input.title);

  // Check limit
  const countResult = await pool.query<{ count: number }>(
    `select count(*)::int from weekly_plan_series where profile_id = $1 and archived = false`,
    [profileId],
  );
  if (Number(countResult.rows[0].count) >= WEEKLY_PLAN_SERIES_LIMIT) {
    throw new ValidationError(`Limite de ${WEEKLY_PLAN_SERIES_LIMIT} planos ativos atingido.`);
  }

  // Validate repeat rule
  if (input.repeatType !== "once" && (!input.repeatDays || input.repeatDays.length === 0)) {
    throw new ValidationError("Selecione pelo menos um dia da semana.");
  }
  if (input.repeatType === "interval" && (!input.repeatInterval || input.repeatInterval < 2 || input.repeatInterval > 8)) {
    throw new ValidationError("O intervalo deve ser de 2 a 8 semanas.");
  }
  if (input.repeatType === "once" && input.repeatDays && input.repeatDays.length > 1) {
    throw new ValidationError("Um plano de uma vez não pode ter múltiplos dias.");
  }

  const startDate = input.startDate;
  const categoryId = input.categoryId !== undefined
    ? await assertCategoryForProfile(profileId, input.categoryId)
    : await resolveDefaultCategoryId();

  const inserted = await pool.query<{ id: string | number }>(
    `insert into weekly_plan_series (profile_id, title, category_id, icon_type, icon_value, color, note,
       repeat_type, repeat_days, repeat_interval, start_time, duration_minutes, start_date,
       end_type, end_date, end_count, timezone)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::date, $14, $15::date, $16, $17)
     returning id`,
    [
      profileId, title, categoryId,
      input.iconType ?? "asset", input.iconValue ?? null, input.color ?? null, input.note ?? null,
      input.repeatType, input.repeatDays ?? null, input.repeatInterval ?? null,
      input.startTime ?? null, input.durationMinutes ?? null, startDate,
      input.endType ?? "never", input.endDate ?? null, input.endCount ?? null,
      input.timezone ?? "America/Sao_Paulo",
    ],
  );
  const result = await pool.query<SeriesRow>(`${SERIES_SELECT} where s.id = $1`, [inserted.rows[0].id]);
  return mapSeries(result.rows[0]);
}

export interface UpdateWeeklyPlanSeriesInput {
  title?: string;
  categoryId?: number;
  iconType?: "asset" | "emoji" | "image" | null;
  iconValue?: string | null;
  color?: string | null;
  note?: string | null;
  repeatType?: PlanRepeatType;
  repeatDays?: number[] | null;
  repeatInterval?: number | null;
  startTime?: string | null;
  durationMinutes?: number | null;
  startDate?: string;
  endType?: PlanEndType;
  endDate?: string | null;
  endCount?: number | null;
}

export async function updateWeeklyPlanSeries(
  profileId: string,
  seriesId: number,
  input: UpdateWeeklyPlanSeriesInput,
): Promise<WeeklyPlanSeries> {
  parseProfileId(profileId);
  if (!Number.isInteger(seriesId) || seriesId <= 0) throw new ValidationError("Plano inválido.");

  const title = input.title !== undefined ? parseTitle(input.title) : undefined;
  const categoryId = input.categoryId !== undefined ? await assertCategoryForProfile(profileId, input.categoryId) : undefined;

  const sets: string[] = [];
  const colValues: unknown[] = [];
  let n = 0;
  const push = (sql: string, val: unknown) => {
    n += 1;
    sets.push(sql.replace("$N", `$${n}`));
    colValues.push(val);
  };
  if (title !== undefined) push("title = $N", title);
  if (categoryId !== undefined) push("category_id = $N", categoryId);
  if (input.iconType !== undefined) push("icon_type = $N", input.iconType);
  if (input.iconValue !== undefined) push("icon_value = $N", input.iconValue);
  if (input.color !== undefined) push("color = $N", input.color);
  if (input.note !== undefined) push("note = $N", input.note);
  if (input.repeatType !== undefined) push("repeat_type = $N", input.repeatType);
  if (input.repeatDays !== undefined) push("repeat_days = $N", input.repeatDays);
  if (input.repeatInterval !== undefined) push("repeat_interval = $N", input.repeatInterval);
  if (input.startTime !== undefined) push("start_time = $N", input.startTime);
  if (input.durationMinutes !== undefined) push("duration_minutes = $N", input.durationMinutes);
  if (input.startDate !== undefined) push("start_date = $N::date", input.startDate);
  if (input.endType !== undefined) push("end_type = $N", input.endType);
  if (input.endDate !== undefined) push("end_date = $N::date", input.endDate);
  if (input.endCount !== undefined) push("end_count = $N", input.endCount);
  if (sets.length === 0) throw new ValidationError("Nada para atualizar.");

  colValues.push(profileId, seriesId);
  const updated = await pool.query<{ id: string | number }>(
    `update weekly_plan_series set ${sets.join(", ")}
     where profile_id = $${n + 1} and id = $${n + 2} and archived = false
     returning id`,
    colValues,
  );
  if (!updated.rows[0]) throw new NotFoundError("Plano não encontrado.");
  const result = await pool.query<SeriesRow>(`${SERIES_SELECT} where s.id = $1`, [updated.rows[0].id]);
  return mapSeries(result.rows[0]);
}

export async function deleteWeeklyPlanSeries(profileId: string, seriesId: number): Promise<void> {
  parseProfileId(profileId);
  if (!Number.isInteger(seriesId) || seriesId <= 0) throw new ValidationError("Plano inválido.");
  const result = await pool.query(
    `update weekly_plan_series set archived = true
     where profile_id = $1 and id = $2 and archived = false
     returning id`,
    [profileId, seriesId],
  );
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Plano não encontrado.");
}

export async function getWeeklyPlanSeries(profileId: string, seriesId: number): Promise<WeeklyPlanSeries> {
  parseProfileId(profileId);
  if (!Number.isInteger(seriesId) || seriesId <= 0) throw new ValidationError("Plano inválido.");
  const result = await pool.query<SeriesRow>(
    `${SERIES_SELECT} where s.profile_id = $1 and s.id = $2 and s.archived = false`,
    [profileId, seriesId],
  );
  if (!result.rows[0]) throw new NotFoundError("Plano não encontrado.");
  return mapSeries(result.rows[0]);
}

// ── Occurrence expansion ────────────────────────────────────────────────────────

/**
 * Compute the dates on which a series occurs within a given week (Mon–Sun).
 * Returns an array of ISO date strings (YYYY-MM-DD).
 */
export function expandWeeklyPlanSeries(
  series: Pick<WeeklyPlanSeries, "repeatType" | "repeatDays" | "repeatInterval" | "startDate" | "endType" | "endDate" | "endCount" | "timezone">,
  weekStart: string, // Monday of the week, ISO date
): string[] {
  // Parse dates in the user's timezone
  const startDate = new Date(series.startDate + "T12:00:00");
  const weekStartD = new Date(weekStart + "T12:00:00");
  const weekEndD = new Date(weekStart + "T12:00:00");
  weekEndD.setDate(weekEndD.getDate() + 6); // Sunday

  // End date boundary
  let endDateLimit: Date | null = null;
  if (series.endType === "date" && series.endDate) {
    endDateLimit = new Date(series.endDate + "T12:00:00");
  }

  const occurrences: string[] = [];

  // For "once" type, just check if the start date falls in this week
  if (series.repeatType === "once") {
    if (startDate >= weekStartD && startDate <= weekEndD) {
      // Check end count
      if (series.endType === "count" && series.endCount !== null && series.endCount > 0) {
        if (1 <= series.endCount) {
          occurrences.push(series.startDate);
        }
      } else if (endDateLimit === null || startDate <= endDateLimit) {
        occurrences.push(series.startDate);
      }
    }
    return occurrences;
  }

  // For weekly/interval, iterate through each day of the week
  const targetDays = series.repeatDays || [];
  const interval = series.repeatInterval || 1;

  // For end count, we need to count total occurrences across ALL weeks,
  // not just the current one. We do this by counting how many occurrences
  // would have happened in weeks before this one.
  let preWeekCount = 0;
  if (series.endType === "count" && series.endCount !== null && series.endCount > 0) {
    // Count occurrences in weeks strictly before this week
    const prevWeekStart = new Date(weekStartD);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7); // Start from previous week
    const tempWeekStart = new Date(prevWeekStart);
    while (tempWeekStart >= startDate || tempWeekStart.getDate() >= startDate.getDate()) {
      // Only process if this temp week could have occurrences
      const tempWeekEnd = new Date(tempWeekStart);
      tempWeekEnd.setDate(tempWeekEnd.getDate() + 6);
      if (tempWeekEnd < startDate) break;
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const d = new Date(tempWeekStart);
        d.setDate(d.getDate() + dayOffset);
        if (d < startDate) continue;
        if (endDateLimit && d > endDateLimit) continue;
        if (!targetDays.includes(d.getDay())) continue;
        if (interval > 1) {
          const msPerWeek = 7 * 24 * 60 * 60 * 1000;
          const diffMs = d.getTime() - startDate.getTime();
          const weeksSinceStart = Math.floor(diffMs / msPerWeek);
          if (weeksSinceStart % interval !== 0) continue;
        }
        preWeekCount++;
        if (preWeekCount >= (series.endCount ?? 0)) break;
      }
      if (preWeekCount >= (series.endCount ?? 0)) break;
      // Go back one week
      tempWeekStart.setDate(tempWeekStart.getDate() - 7);
      // Safety: don't loop forever
      if (tempWeekStart.getTime() < startDate.getTime() - 365 * 7 * 24 * 60 * 60 * 1000) break;
    }
  }

  let totalOccurrences = preWeekCount;

  // Calculate which week number this is relative to the series start
  // We need to check if each day in the week falls on a target day AND
  // the week number matches the interval
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const currentDate = new Date(weekStartD);
    currentDate.setDate(currentDate.getDate() + dayOffset);

    // Check if this date is on or after the series start date
    if (currentDate < startDate) continue;

    // Check end date
    if (endDateLimit && currentDate > endDateLimit) continue;

    // Get the JS weekday (0=Sun, 1=Mon, ..., 6=Sat)
    const jsWeekday = currentDate.getDay();

    // Check if this weekday is in the target days
    if (!targetDays.includes(jsWeekday)) continue;

    // For interval type, check if this week is within the interval
    if (interval > 1) {
      // Calculate weeks since start
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const diffMs = currentDate.getTime() - startDate.getTime();
      const weeksSinceStart = Math.floor(diffMs / msPerWeek);

      // Check if this week falls within the interval
      if (weeksSinceStart % interval !== 0) continue;
    }

    // Check end count
    if (series.endType === "count" && series.endCount !== null && series.endCount > 0) {
      totalOccurrences++;
      if (totalOccurrences > series.endCount) continue;
    }

    occurrences.push(currentDate.toISOString().slice(0, 10));
  }

  return occurrences;
}

// ── Occurrence state ────────────────────────────────────────────────────────────

export async function setOccurrenceCompleted(
  profileId: string,
  seriesId: number,
  occurrenceDate: string,
  completed: boolean,
): Promise<void> {
  parseProfileId(profileId);
  if (!Number.isInteger(seriesId) || seriesId <= 0) throw new ValidationError("Plano inválido.");

  // Verify ownership first
  const check = await pool.query(
    `select 1 from weekly_plan_series where id = $1 and profile_id = $2 and archived = false`,
    [seriesId, profileId],
  );
  if (!check.rows[0]) throw new NotFoundError("Plano não encontrado.");

  await pool.query(
    `insert into weekly_plan_occurrences (series_id, occurrence_date, completed_at)
     values ($1, $2::date, $3)
     on conflict (series_id, occurrence_date)
     do update set completed_at = $3, skipped = false`,
    [seriesId, occurrenceDate, completed ? new Date() : null],
  );
}

export async function skipOccurrence(profileId: string, seriesId: number, occurrenceDate: string): Promise<void> {
  parseProfileId(profileId);
  if (!Number.isInteger(seriesId) || seriesId <= 0) throw new ValidationError("Plano inválido.");

  // Verify ownership first
  const check = await pool.query(
    `select 1 from weekly_plan_series where id = $1 and profile_id = $2 and archived = false`,
    [seriesId, profileId],
  );
  if (!check.rows[0]) throw new NotFoundError("Plano não encontrado.");

  await pool.query(
    `insert into weekly_plan_occurrences (series_id, occurrence_date, skipped)
     values ($1, $2::date, true)
     on conflict (series_id, occurrence_date)
     do update set skipped = true, completed_at = null`,
    [seriesId, occurrenceDate],
  );
}

export interface OccurrenceOverrideInput {
  title?: string;
  startTime?: string | null;
}

export async function updateOccurrenceOverride(
  profileId: string,
  seriesId: number,
  occurrenceDate: string,
  input: OccurrenceOverrideInput,
): Promise<void> {
  parseProfileId(profileId);
  if (!Number.isInteger(seriesId) || seriesId <= 0) throw new ValidationError("Plano inválido.");

  // Verify ownership first
  const check = await pool.query(
    `select 1 from weekly_plan_series where id = $1 and profile_id = $2 and archived = false`,
    [seriesId, profileId],
  );
  if (!check.rows[0]) throw new NotFoundError("Plano não encontrado.");

  const sets: string[] = [];
  const values: unknown[] = [];
  let n = 0;
  const push = (sql: string, val: unknown) => {
    n += 1;
    sets.push(sql.replace("$N", `$${n}`));
    values.push(val);
  };
  if (input.title !== undefined) push("override_title = $N", input.title);
  if (input.startTime !== undefined) push("override_start_time = $N", input.startTime);
  if (sets.length === 0) throw new ValidationError("Nada para atualizar.");

  values.push(seriesId, occurrenceDate);
  await pool.query(
    `insert into weekly_plan_occurrences (series_id, occurrence_date)
     values ($${n + 1}, $${n + 2}::date)
     on conflict (series_id, occurrence_date)
     do update set ${sets.join(", ")}`,
    values,
  );
}

// ── Unified list ────────────────────────────────────────────────────────────────

/**
 * Returns all plan items for a given week, combining:
 * 1. Old one-time weekly_plans rows (legacy)
 * 2. Expanded recurring series occurrences
 */
export async function listWeeklyPlanOccurrences(profileId: string, weekStart: string): Promise<WeeklyPlanItem[]> {
  parseProfileId(profileId);
  const weekEnd = new Date(weekStart + "T12:00:00");
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const items: WeeklyPlanItem[] = [];

  // 1. Legacy weekly_plans rows
  const legacyResult = await pool.query(
    `select w.id, w.plan_date, w.title, w.category_id, w.completed_at, w.start_time,
            c.id as category_id, c.user_id as category_user_id, c.name as category_name,
            c.color as category_color, c.icon as category_icon, c.is_custom as category_is_custom,
            c.created_at as category_created_at
     from weekly_plans w
     join categories c on c.id = w.category_id
     where w.profile_id = $1 and w.plan_date >= $2::date and w.plan_date <= $3::date
     order by w.plan_date, w.id`,
    [profileId, weekStart, weekEndStr],
  );

  for (const row of legacyResult.rows) {
    items.push({
      id: Number(row.id),
      seriesId: null,
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
      iconType: null,
      iconValue: null,
      color: null,
      note: null,
      completedAt: row.completed_at ? (typeof row.completed_at === "string" ? row.completed_at : row.completed_at.toISOString()) : null,
      skipped: false,
      startTime: row.start_time,
      durationMinutes: null,
      repeatType: null,
      repeatDays: null,
      isRecurring: false,
    });
  }

  // 2. Recurring series
  const seriesResult = await pool.query<SeriesRow>(
    `${SERIES_SELECT} where s.profile_id = $1 and s.archived = false`,
    [profileId],
  );

  for (const row of seriesResult.rows) {
    const series = mapSeries(row);
    const dates = expandWeeklyPlanSeries(series, weekStart);

    for (const date of dates) {
      // Check if there's an occurrence record with state
      const occResult = await pool.query(
        `select id, completed_at, skipped, override_title, override_start_time
         from weekly_plan_occurrences
         where series_id = $1 and occurrence_date = $2::date`,
        [series.id, date],
      );
      const occ = occResult.rows[0];

      items.push({
        id: occ ? Number(occ.id) : series.id, // use occurrence id if exists, else series id
        seriesId: series.id,
        planDate: date,
        title: occ?.override_title || series.title,
        categoryId: series.categoryId,
        category: series.category,
        iconType: series.iconType,
        iconValue: series.iconValue,
        color: series.color,
        note: series.note,
        completedAt: occ?.completed_at ? (typeof occ.completed_at === "string" ? occ.completed_at : occ.completed_at.toISOString()) : null,
        skipped: occ?.skipped ?? false,
        startTime: occ?.override_start_time || series.startTime,
        durationMinutes: series.durationMinutes,
        repeatType: series.repeatType,
        repeatDays: series.repeatDays,
        isRecurring: series.repeatType !== "once",
      });
    }
  }

  // Sort by date, then start time, then id
  items.sort((a, b) => {
    if (a.planDate !== b.planDate) return a.planDate.localeCompare(b.planDate);
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    if (a.startTime) return -1;
    if (b.startTime) return 1;
    return a.id - b.id;
  });

  return items;
}
