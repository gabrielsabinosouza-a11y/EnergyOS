import pool from "../db";
import type { WeeklyPlanSeries, WeeklyPlanItem, PlanRepeatType, PlanEndType, Category } from "@/types";
import { NotFoundError } from "../errors";
import { ValidationError, parseDate, parseOptionalTime, parseProfileId, parseTitle } from "./validation";
import { assertCategoryForProfile, resolveDefaultCategoryId } from "./categories";
import { WEEKLY_PLAN_SERIES_LIMIT, PLAN_NAME_MAX } from "../daily-limits";
import { grantPlannerCompletionReward, updatePlannerLeagueXP, type PlannerRewardResult } from "./planner-rewards";
import { ensureXpLedgerSourceCheck } from "./xp-ledger";
import { addDays, parseIsoKey, weekStart } from "@/lib/planning/dates";

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
      reminder_offset_min int,
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
      reminder_offset_min int,
      unique (series_id, occurrence_date)
    )
  `);
  // Ensure the xp_ledger source CHECK constraint exists with the complete
  // list of valid sources (centralised — see ensureXpLedgerSourceCheck).
  await ensureXpLedgerSourceCheck();
  await pool.query(`create index if not exists idx_wps_profile on weekly_plan_series(profile_id, archived)`);
  await pool.query(`create index if not exists idx_wpo_series_date on weekly_plan_occurrences(series_id, occurrence_date)`);
}

// ── Query helpers ───────────────────────────────────────────────────────────────

const SERIES_SELECT = `
  select s.id, s.profile_id, s.title, s.category_id, s.icon_type, s.icon_value,
         s.color, s.note, s.repeat_type, s.repeat_days, s.repeat_interval,
         s.start_time, s.duration_minutes, s.reminder_offset_min, s.start_date::text as start_date, s.end_type, s.end_date::text as end_date,
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
  reminder_offset_min: number | null;
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
    startTime: row.start_time?.slice(0, 5) ?? null,
    durationMinutes: row.duration_minutes,
    reminderOffsetMin: row.reminder_offset_min,
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
  reminderOffsetMin?: number | null;
}

function validateSeriesRule(input: {
  repeatType?: PlanRepeatType;
  repeatDays?: number[] | null;
  repeatInterval?: number | null;
  startDate?: string;
  endType?: PlanEndType;
  endDate?: string | null;
  endCount?: number | null;
}) {
  if (input.repeatType !== undefined && !["once", "weekly", "interval"].includes(input.repeatType)) {
    throw new ValidationError("Tipo de repetição inválido.");
  }
  if (input.repeatDays !== undefined && input.repeatDays !== null) {
    if (!Array.isArray(input.repeatDays) || input.repeatDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      throw new ValidationError("Selecione dias da semana válidos.");
    }
    input.repeatDays = [...new Set(input.repeatDays)];
  }
  if (input.repeatType !== undefined && input.repeatType !== "once" && (!input.repeatDays || input.repeatDays.length === 0)) {
    throw new ValidationError("Selecione pelo menos um dia da semana.");
  }
  if (input.repeatType === "interval" && (
    !Number.isInteger(input.repeatInterval) || (input.repeatInterval ?? 0) < 2 || (input.repeatInterval ?? 0) > 8
  )) {
    throw new ValidationError("O intervalo deve ser de 2 a 8 semanas.");
  }
  if (input.repeatType === "once" && input.repeatDays && input.repeatDays.length > 1) {
    throw new ValidationError("Um plano de uma vez não pode ter múltiplos dias.");
  }
  if (input.endType !== undefined && !["never", "date", "count"].includes(input.endType)) {
    throw new ValidationError("Tipo de encerramento inválido.");
  }
  if (input.endType === "date") {
    const endDate = parseDate(input.endDate, "Data final da repetição");
    if (input.startDate && endDate < input.startDate) {
      throw new ValidationError("A data final da repetição deve ser igual ou posterior à data inicial.");
    }
  }
  if (input.endType === "count" && (!Number.isInteger(input.endCount) || (input.endCount ?? 0) < 1)) {
    throw new ValidationError("A quantidade de repetições deve ser maior que zero.");
  }
}

export async function createWeeklyPlanSeries(
  profileId: string,
  input: CreateWeeklyPlanSeriesInput,
): Promise<WeeklyPlanSeries> {
  parseProfileId(profileId);
  const title = parseTitle(input.title);

  // Plan names have a tighter soft limit than parseTitle's generic 200-char
  // maximum. Reject at PLAN_NAME_MAX (120) so the server is consistent with
  // the frontend PlanNameInput component.
  if (title.length > PLAN_NAME_MAX) {
    throw new ValidationError(`Use até ${PLAN_NAME_MAX} caracteres. Coloque os detalhes na nota.`);
  }
  if (!input.repeatType) throw new ValidationError("Tipo de repetição inválido.");

  // Check limit
  const countResult = await pool.query<{ count: number }>(
    `select count(*)::int from weekly_plan_series where profile_id = $1 and archived = false`,
    [profileId],
  );
  if (Number(countResult.rows[0].count) >= WEEKLY_PLAN_SERIES_LIMIT) {
    throw new ValidationError(`Limite de ${WEEKLY_PLAN_SERIES_LIMIT} planos ativos atingido.`);
  }

  validateSeriesRule(input);
  const startDate = parseDate(input.startDate, "Data do plano");
  const startTime = parseOptionalTime(input.startTime, "Horário de início");
  const endType = input.endType ?? "never";
  const endDate = endType === "date" ? parseDate(input.endDate, "Data final da repetição") : null;
  const durationMinutes = input.durationMinutes ?? null;
  if (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440)) {
    throw new ValidationError("Duração do plano inválida.");
  }
  const timezone = input.timezone ?? "America/Sao_Paulo";
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: timezone });
  } catch {
    throw new ValidationError("Fuso horário inválido.");
  }
  const categoryId = input.categoryId !== undefined
    ? await assertCategoryForProfile(profileId, input.categoryId)
    : await resolveDefaultCategoryId();

  const inserted = await pool.query<{ id: string | number }>(
    `insert into weekly_plan_series (profile_id, title, category_id, icon_type, icon_value, color, note,
       repeat_type, repeat_days, repeat_interval, start_time, duration_minutes, reminder_offset_min, start_date,
       end_type, end_date, end_count, timezone)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::date, $15, $16::date, $17, $18)
     returning id`,
    [
      profileId, title, categoryId,
      input.iconType ?? "asset", input.iconValue ?? null, input.color ?? null, input.note ?? null,
      input.repeatType, input.repeatDays ?? null, input.repeatInterval ?? null,
      startTime, durationMinutes, input.reminderOffsetMin ?? null, startDate,
      endType, endDate, input.endCount ?? null,
      timezone,
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
  reminderOffsetMin?: number | null;
}

export async function updateWeeklyPlanSeries(
  profileId: string,
  seriesId: number,
  input: UpdateWeeklyPlanSeriesInput,
): Promise<WeeklyPlanSeries> {
  parseProfileId(profileId);
  if (!Number.isInteger(seriesId) || seriesId <= 0) throw new ValidationError("Plano inválido.");

  const title = input.title !== undefined ? parseTitle(input.title) : undefined;
  validateSeriesRule(input);

  // Plan names have a tighter soft limit than parseTitle's generic 200-char
  // maximum. Reject at PLAN_NAME_MAX (120) for consistency with the frontend.
  if (title !== undefined && title.length > PLAN_NAME_MAX) {
    throw new ValidationError(`Use até ${PLAN_NAME_MAX} caracteres. Coloque os detalhes na nota.`);
  }

  const categoryId = input.categoryId !== undefined ? await assertCategoryForProfile(profileId, input.categoryId) : undefined;
  const startDate = input.startDate !== undefined ? parseDate(input.startDate, "Data do plano") : undefined;
  const endDate = input.endDate !== undefined && input.endDate !== null
    ? parseDate(input.endDate, "Data final da repetição")
    : input.endDate;
  const startTime = input.startTime !== undefined ? parseOptionalTime(input.startTime, "Horário de início") : undefined;
  if (input.durationMinutes !== undefined && input.durationMinutes !== null
    && (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 1440)) {
    throw new ValidationError("Duração do plano inválida.");
  }
  if (startDate && endDate && endDate < startDate) {
    throw new ValidationError("A data final da repetição deve ser igual ou posterior à data inicial.");
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
  if (categoryId !== undefined) push("category_id = $N", categoryId);
  if (input.iconType !== undefined) push("icon_type = $N", input.iconType);
  if (input.iconValue !== undefined) push("icon_value = $N", input.iconValue);
  if (input.color !== undefined) push("color = $N", input.color);
  if (input.note !== undefined) push("note = $N", input.note);
  if (input.repeatType !== undefined) push("repeat_type = $N", input.repeatType);
  if (input.repeatDays !== undefined) push("repeat_days = $N", input.repeatDays);
  if (input.repeatInterval !== undefined) push("repeat_interval = $N", input.repeatInterval);
  if (startTime !== undefined) push("start_time = $N", startTime);
  if (input.durationMinutes !== undefined) push("duration_minutes = $N", input.durationMinutes);
  if (input.reminderOffsetMin !== undefined) push("reminder_offset_min = $N", input.reminderOffsetMin);
  if (startDate !== undefined) push("start_date = $N::date", startDate);
  if (input.endType !== undefined) push("end_type = $N", input.endType);
  if (endDate !== undefined) push("end_date = $N::date", endDate);
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
  const weekEnd = addDays(weekStart, 6);
  const endDate = series.endType === "date" ? series.endDate : null;
  const countLimit = series.endType === "count" && (series.endCount ?? 0) > 0
    ? series.endCount
    : null;
  if (series.repeatType === "once") {
    return series.startDate >= weekStart
      && series.startDate <= weekEnd
      && (!endDate || series.startDate <= endDate)
      && (countLimit === null || countLimit >= 1)
      ? [series.startDate]
      : [];
  }

  const targetDays = series.repeatDays ?? [];
  if (targetDays.length === 0) return [];
  const interval = Math.max(1, series.repeatInterval ?? 1);
  const ordinal = (date: string) => {
    const { year, month, day } = parseIsoKey(date);
    return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  };
  const startOrdinal = ordinal(series.startDate);
  const isOccurrence = (date: string) => {
    if (date < series.startDate || (endDate && date > endDate)) return false;
    const { year, month, day } = parseIsoKey(date);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (!targetDays.includes(weekday)) return false;
    const weeksSinceStart = Math.floor((ordinal(date) - startOrdinal) / 7);
    return weeksSinceStart % interval === 0;
  };

  let priorCount = 0;
  if (countLimit !== null) {
    for (let date = series.startDate; date < weekStart; date = addDays(date, 1)) {
      if (endDate && date > endDate) break;
      if (isOccurrence(date)) {
        priorCount += 1;
        if (priorCount >= countLimit) return [];
      }
    }
  }

  const occurrences: string[] = [];
  for (let date = weekStart; date <= weekEnd; date = addDays(date, 1)) {
    if (!isOccurrence(date)) continue;
    if (countLimit !== null && priorCount >= countLimit) break;
    occurrences.push(date);
    priorCount += 1;
  }
  return occurrences;
}

interface SeriesRuleRow {
  id: string | number;
  start_date: string;
  repeat_type: string;
  repeat_days: number[] | null;
  repeat_interval: number | null;
  end_type: string;
  end_date: string | null;
  end_count: number | null;
  timezone: string;
}

function assertOccurrenceIsValid(rule: SeriesRuleRow, occurrenceDate: string) {
  const dates = expandWeeklyPlanSeries({
    repeatType: rule.repeat_type as PlanRepeatType,
    repeatDays: rule.repeat_days,
    repeatInterval: rule.repeat_interval,
    startDate: rule.start_date,
    endType: rule.end_type as PlanEndType,
    endDate: rule.end_date,
    endCount: rule.end_count,
    timezone: rule.timezone,
  }, weekStart(occurrenceDate));
  if (!dates.includes(occurrenceDate)) {
    throw new ValidationError("Esta data não pertence à série do plano.");
  }
}

async function getOccurrenceRule(profileId: string, seriesId: number): Promise<SeriesRuleRow> {
  const result = await pool.query<SeriesRuleRow>(
    `select id, start_date::text as start_date, repeat_type, repeat_days, repeat_interval, end_type, end_date::text as end_date, end_count, timezone
     from weekly_plan_series where id = $1 and profile_id = $2 and archived = false`,
    [seriesId, profileId],
  );
  if (!result.rows[0]) throw new NotFoundError("Plano não encontrado.");
  return result.rows[0];
}

// ── Occurrence state ────────────────────────────────────────────────────────────

export async function setOccurrenceCompleted(
  profileId: string,
  seriesId: number,
  occurrenceDate: string,
  completed: boolean,
): Promise<PlannerRewardResult> {
  parseProfileId(profileId);
  if (!Number.isInteger(seriesId) || seriesId <= 0) throw new ValidationError("Plano inválido.");
  occurrenceDate = parseDate(occurrenceDate, "Data da ocorrência");

  const client = await pool.connect();
  let reward = { xpAwarded: 0, coinsAwarded: 0 };
  try {
    await client.query("begin");
    const owner = await client.query<SeriesRuleRow>(
      `select id, start_date::text as start_date, repeat_type, repeat_days, repeat_interval, end_type, end_date::text as end_date, end_count, timezone
       from weekly_plan_series where id = $1 and profile_id = $2 and archived = false for update`,
      [seriesId, profileId],
    );
    if (!owner.rows[0]) throw new NotFoundError("Plano não encontrado.");
    assertOccurrenceIsValid(owner.rows[0], occurrenceDate);
    await client.query(
      `insert into weekly_plan_occurrences (series_id, occurrence_date, completed_at)
       values ($1, $2::date, $3)
       on conflict (series_id, occurrence_date)
       do update set completed_at = $3, skipped = false`,
      [seriesId, occurrenceDate, completed ? new Date() : null],
    );
    reward = await grantPlannerCompletionReward(
      profileId,
      "weekly_plan_occurrence",
      `${seriesId}:${occurrenceDate}`,
      completed,
      client,
      occurrenceDate,
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  await updatePlannerLeagueXP(profileId, reward.xpAwarded);
  return reward;
}

export async function skipOccurrence(profileId: string, seriesId: number, occurrenceDate: string): Promise<void> {
  parseProfileId(profileId);
  if (!Number.isInteger(seriesId) || seriesId <= 0) throw new ValidationError("Plano inválido.");
  occurrenceDate = parseDate(occurrenceDate, "Data da ocorrência");
  assertOccurrenceIsValid(await getOccurrenceRule(profileId, seriesId), occurrenceDate);

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
  reminderOffsetMin?: number | null;
}

export async function updateOccurrenceOverride(
  profileId: string,
  seriesId: number,
  occurrenceDate: string,
  input: OccurrenceOverrideInput,
): Promise<void> {
  parseProfileId(profileId);
  if (!Number.isInteger(seriesId) || seriesId <= 0) throw new ValidationError("Plano inválido.");
  occurrenceDate = parseDate(occurrenceDate, "Data da ocorrência");
  assertOccurrenceIsValid(await getOccurrenceRule(profileId, seriesId), occurrenceDate);

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
  if (input.reminderOffsetMin !== undefined) push("reminder_offset_min = $N", input.reminderOffsetMin);
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

interface LegacyPlanRow {
  id: string | number;
  plan_date: Date | string | null;
  title: string;
  category_id: string | number;
  completed_at: Date | string | null;
  start_time: string | null;
  end_time: string | null;
  reminder_offset_min: number | null;
  category_user_id: string | null;
  category_name: string;
  category_color: string;
  category_icon: string | null;
  category_is_custom: boolean;
  category_created_at: Date | string;
}

/** Converte uma linha de `weekly_plans` (plano avulso) em item da UI. */
function mapLegacyPlanRow(row: LegacyPlanRow): WeeklyPlanItem {
  return {
    id: Number(row.id),
    seriesId: null,
    planDate: row.plan_date
      ? (typeof row.plan_date === "string" ? row.plan_date : row.plan_date.toISOString().slice(0, 10))
      : undefined,
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
    startTime: row.start_time?.slice(0, 5) ?? null,
    endTime: row.end_time?.slice(0, 5) ?? null,
    durationMinutes: null,
    repeatType: null,
    repeatDays: null,
    isRecurring: false,
    reminderOffsetMin: row.reminder_offset_min,
  };
}

const LEGACY_PLAN_SELECT = `
  select w.id, w.plan_date::text as plan_date, w.title, w.category_id, w.completed_at, w.start_time, w.end_time, w.reminder_offset_min,
         c.id as category_id, c.user_id as category_user_id, c.name as category_name,
         c.color as category_color, c.icon as category_icon, c.is_custom as category_is_custom,
         c.created_at as category_created_at
  from weekly_plans w
  join categories c on c.id = w.category_id
`;

/**
 * Planos avulsos SEM data (tarefas não agendadas).
 *
 * Eles não pertencem a nenhuma semana do calendário: por isso vivem em uma
 * lista própria, acessível na seção "Sem data" do Planejamento.
 */
export async function listUnscheduledPlanItems(profileId: string): Promise<WeeklyPlanItem[]> {
  parseProfileId(profileId);
  const result = await pool.query<LegacyPlanRow>(
    `${LEGACY_PLAN_SELECT}
     where w.profile_id = $1 and w.plan_date is null
     order by w.id`,
    [profileId],
  );
  return result.rows.map(mapLegacyPlanRow);
}

/**
 * Returns all plan items for a given week, combining:
 * 1. Old one-time weekly_plans rows (legacy)
 * 2. Expanded recurring series occurrences
 */
export async function listWeeklyPlanOccurrences(profileId: string, weekStart: string): Promise<WeeklyPlanItem[]> {
  parseProfileId(profileId);
  const weekEndStr = addDays(weekStart, 6);

  const items: WeeklyPlanItem[] = [];

  // 1. Legacy weekly_plans rows
  const legacyResult = await pool.query<LegacyPlanRow>(
    `${LEGACY_PLAN_SELECT}
     where w.profile_id = $1 and w.plan_date >= $2::date and w.plan_date <= $3::date
     order by w.plan_date, w.id`,
    [profileId, weekStart, weekEndStr],
  );

  for (const row of legacyResult.rows) {
    items.push(mapLegacyPlanRow(row));
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
        `select id, completed_at, skipped, override_title, override_start_time, reminder_offset_min
         from weekly_plan_occurrences
         where series_id = $1 and occurrence_date = $2::date`,
        [series.id, date],
      );
      const occ = occResult.rows[0];
      if (occ?.skipped) continue;

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
        startTime: occ?.override_start_time?.slice(0, 5) || series.startTime,
        durationMinutes: series.durationMinutes,
        repeatType: series.repeatType,
        repeatDays: series.repeatDays,
        isRecurring: series.repeatType !== "once",
        reminderOffsetMin: occ?.remider_offset_min ?? series.reminderOffsetMin,
      });
    }
  }

  // Sort by date, then start time, then id
  items.sort((a, b) => {
    const dateA = a.planDate ?? "";
    const dateB = b.planDate ?? "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    if (a.startTime) return -1;
    if (b.startTime) return 1;
    return a.id - b.id;
  });

  return items;
}
