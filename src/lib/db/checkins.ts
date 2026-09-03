import pool from "../db";
import type { DailyCheckin } from "@/types";
import { ValidationError, parseDate, parseNumber, parseProfileId } from "./validation";
import { creditXP } from "./xp";
import { addCoins } from "./settings";
import {
  CHECKIN_XP,
  CHECKIN_COINS,
  STREAK_BONUS_XP_PER_DAY,
  STREAK_BONUS_CAP,
} from "../daily-limits";

interface CheckinRow {
  id: string | number;
  profile_id: string;
  checkin_date: Date | string;
  sleep_hours: string | number | null;
  study_minutes: number | null;
  training_minutes: number | null;
  energy_score: number | null;
}

function mapCheckin(row: CheckinRow): DailyCheckin {
  return {
    id: Number(row.id),
    profileId: row.profile_id,
    checkinDate: typeof row.checkin_date === "string" ? row.checkin_date : row.checkin_date.toISOString().slice(0, 10),
    sleepHours: row.sleep_hours === null ? undefined : Number(row.sleep_hours),
    studyMinutes: row.study_minutes ?? undefined,
    trainingMinutes: row.training_minutes ?? undefined,
    energyScore: row.energy_score ?? undefined,
  };
}

export interface UpsertCheckinInput {
  checkinDate?: string;
  sleepHours?: number;
  studyMinutes?: number;
  trainingMinutes?: number;
  energyScore?: number;
}

export async function upsertCheckin(
  profileId: string,
  input: UpsertCheckinInput,
  today: string,
): Promise<{ checkin: DailyCheckin; xpAwarded: number; coinsAwarded: number }> {
  parseProfileId(profileId);
  // SECURITY: rewards are only granted for TODAY's check-in. The date is
  // resolved server-side; a client-supplied checkinDate for any other day is
  // rejected (prevents backdating XP/coin/streak farming).
  if (input.checkinDate !== undefined && input.checkinDate !== today) {
    throw new ValidationError("O check-in só pode ser registrado para o dia de hoje.");
  }
  const date = today;
  const hasAnyValue =
    input.sleepHours !== undefined ||
    input.studyMinutes !== undefined ||
    input.trainingMinutes !== undefined ||
    input.energyScore !== undefined;
  if (!hasAnyValue) {
    throw new ValidationError("Informe pelo menos um dado do check-in.");
  }

  const sleepHours = input.sleepHours === undefined ? null : parseNumber(input.sleepHours, "Horas de sono", { min: 0, max: 24 });
  const studyMinutes = input.studyMinutes === undefined ? null : parseNumber(input.studyMinutes, "Minutos de estudo", { min: 0, max: 1440, integer: true });
  const trainingMinutes = input.trainingMinutes === undefined ? null : parseNumber(input.trainingMinutes, "Minutos de treino", { min: 0, max: 1440, integer: true });
  const energyScore = input.energyScore === undefined ? null : parseNumber(input.energyScore, "Nível de energia", { min: 1, max: 5, integer: true });

  try {
    // Atomic first-save detection: on a fresh INSERT xmax is 0; on a
    // conflict-update it is set. This closes the TOCTOU race where two
    // concurrent first saves would both award the daily reward.
    const result = await pool.query<CheckinRow & { inserted: boolean }>(
      `insert into daily_checkins (profile_id, checkin_date, sleep_hours, study_minutes, training_minutes, energy_score)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (profile_id, checkin_date) do update set
         sleep_hours = coalesce(excluded.sleep_hours, daily_checkins.sleep_hours),
         study_minutes = coalesce(excluded.study_minutes, daily_checkins.study_minutes),
         training_minutes = coalesce(excluded.training_minutes, daily_checkins.training_minutes),
         energy_score = coalesce(excluded.energy_score, daily_checkins.energy_score)
       returning id, profile_id, checkin_date, sleep_hours, study_minutes, training_minutes, energy_score, (xmax = 0) as inserted`,
      [profileId, date, sleepHours, studyMinutes, trainingMinutes, energyScore],
    );
    const isNew = Boolean(result.rows[0]?.inserted);

    if (isNew) {
      // Base check-in reward (creditXP is idempotent via the ledger unique index)
      const xpBase = await creditXP(profileId, "checkin", result.rows[0].id, CHECKIN_XP);
      await addCoins(profileId, CHECKIN_COINS);

      // Per-day streak bonus (capped); ledger key is the date, so it can only
      // be awarded once per day even under retries.
      const streakRow = await pool.query<{ current_streak: number }>(
        `select current_streak from profiles where id = $1`,
        [profileId],
      );
      const streak = streakRow.rows[0]?.current_streak ?? 0;
      const streakBonus = streak > 0 ? Math.min(streak * STREAK_BONUS_XP_PER_DAY, STREAK_BONUS_CAP) : 0;
      const xpStreak = streakBonus > 0
        ? await creditXP(profileId, "checkin_streak", date, streakBonus)
        : 0;

      return {
        checkin: mapCheckin(result.rows[0]),
        xpAwarded: xpBase + xpStreak,
        coinsAwarded: CHECKIN_COINS,
      };
    }

    return { checkin: mapCheckin(result.rows[0]), xpAwarded: 0, coinsAwarded: 0 };
  } catch (error) {
    console.error('[checkins db] Error upserting checkin:', error);
    throw error;
  }
}

export async function listCheckins(profileId: string, from: string, to: string): Promise<DailyCheckin[]> {
  parseProfileId(profileId);
  const result = await pool.query<CheckinRow>(
    `select id, profile_id, checkin_date, sleep_hours, study_minutes, training_minutes, energy_score
     from daily_checkins
     where profile_id = $1 and checkin_date between $2::date and $3::date
     order by checkin_date desc`,
    [profileId, from, to],
  );
  return result.rows.map(mapCheckin);
}

export interface PeriodAverages {
  sleepHours: number | null;
  studyMinutes: number | null;
  trainingMinutes: number | null;
  energyScore: number | null;
  daysWithCheckin: number;
}

export async function averagesForRange(profileId: string, from: string, to: string): Promise<PeriodAverages> {
  parseProfileId(profileId);
  const result = await pool.query<{
    avg_sleep: string | null;
    avg_study: string | null;
    avg_training: string | null;
    avg_energy: string | null;
    days: string | number;
  }>(
    `select avg(sleep_hours) as avg_sleep,
            avg(study_minutes) as avg_study,
            avg(training_minutes) as avg_training,
            avg(energy_score) as avg_energy,
            count(*) as days
     from daily_checkins
     where profile_id = $1 and checkin_date between $2::date and $3::date`,
    [profileId, from, to],
  );
  const row = result.rows[0];
  return {
    sleepHours: row.avg_sleep === null ? null : Math.round(Number(row.avg_sleep) * 10) / 10,
    studyMinutes: row.avg_study === null ? null : Math.round(Number(row.avg_study)),
    trainingMinutes: row.avg_training === null ? null : Math.round(Number(row.avg_training)),
    energyScore: row.avg_energy === null ? null : Math.round(Number(row.avg_energy) * 10) / 10,
    daysWithCheckin: Number(row.days),
  };
}
