import pool from "../db";
import type { FocusSession } from "@/types";
import { NotFoundError } from "../errors";
import { ValidationError, parseProfileId } from "./validation";
import { todayIso, APP_TIMEZONE } from "./dates";
import { recordMissionProgress } from "./daily-quests";
import { onFocusSessionCompleted } from "./tasks";
import { addCoins } from "./settings";
import { creditXP } from "./xp";
import { recordGroupContribution } from "./group-leaderboard";
import { checkAndUnlockMilestones } from "./group-milestones";
import { FOCUS_XP_PER_MIN, FOCUS_COINS_PER_10_MIN, STREAK_COMPLETION_THRESHOLD } from "../daily-limits";
import { FOCUS_DURATION_MAX_MINUTES } from "../focus-duration";

export const GARDEN_ENERGY_TYPES = [
  "flame", "water", "earth", "wind", "thunder", "ice",
  "shadow", "light", "crystal", "cosmic",
  "metal", "poison",
] as const;
export type GardenEnergyType = (typeof GARDEN_ENERGY_TYPES)[number];

/** Recompensa (nº de plantas no jardim) por sessão, conforme o tier. */
export function getEnergyReward(durationMinutes: number): number {
  if (durationMinutes >= 90) return 4;
  if (durationMinutes >= 60) return 2;
  if (durationMinutes >= 10) return 1;
  return 0;
}

/** Calculate growth stage based on session duration */
export function getGrowthStage(durationMinutes: number): GardenGrowthStage {
  if (durationMinutes >= 60) return "mature";
  if (durationMinutes >= 30) return "young";
  return "sprout";
}

export type GardenGrowthStage = "sprout" | "young" | "mature";
export type GardenStatus = "growing" | "alive" | "withered";

export interface GardenEntry {
  id: number;
  energyType: GardenEnergyType;
  durationMinutes: number;
  reward: number;
  plantedAt: string;
  growthStage: GardenGrowthStage;
  status: GardenStatus;
}

interface GardenRow {
  id: string | number;
  profile_id: string;
  session_id: string | number;
  energy_type: string;
  duration_minutes: string | number;
  reward: string | number;
  planted_at: Date | string;
  growth_stage: string;
  status: string;
}

function mapGardenRow(row: GardenRow): GardenEntry {
  return {
    id: Number(row.id),
    energyType: row.energy_type as GardenEnergyType,
    durationMinutes: Number(row.duration_minutes),
    reward: Number(row.reward),
    plantedAt: typeof row.planted_at === "string" ? row.planted_at : row.planted_at.toISOString(),
    growthStage: (row.growth_stage || "sprout") as GardenGrowthStage,
    status: (row.status || "growing") as GardenStatus,
  };
}

/** Busca as energias plantadas pelo usuário, da mais recente para a mais antiga.
 *
 * Self-heals historical rows that never got finalized: entries whose focus
 * session already ended are reconciled to their true state (alive/withered +
 * stage), so a completed energy never renders as an eternal "Crescendo...". */
export async function getGardenEntries(profileId: string): Promise<GardenEntry[]> {
  parseProfileId(profileId);

  // Rows linked to a (non-room) session that already ended: resolve precisely.
  await pool.query(
    `update garden_entries ge
     set status = case
           when fs.duration_minutes >= fs.target_duration_minutes then 'alive'
           else 'withered'
         end,
         growth_stage = case
           when fs.duration_minutes >= 60 then 'mature'
           when fs.duration_minutes >= 30 then 'young'
           else 'sprout'
         end,
         duration_minutes = fs.duration_minutes
     from focus_sessions fs
     where ge.profile_id = $1
       and ge.session_id = fs.id
       and ge.status = 'growing'
       and fs.ended_at is not null`,
    [profileId],
  );

  // Legacy imports represent already-completed focus sessions — never "growing".
  await pool.query(
    `update garden_entries
     set status = 'alive',
         growth_stage = case
           when duration_minutes >= 60 then 'mature'
           when duration_minutes >= 30 then 'young'
           else 'sprout'
         end
     where profile_id = $1
       and status = 'growing'
       and session_id is null
       and legacy_key is not null`,
    [profileId],
  );

  const result = await pool.query<GardenRow>(
    `select id, profile_id, session_id, energy_type, duration_minutes, reward, planted_at, growth_stage, status
     from garden_entries where profile_id = $1 order by planted_at desc, id desc`,
    [profileId],
  );
  return result.rows.map(mapGardenRow);
}

export interface ImportGardenEntry {
  legacyKey: string;
  energyType: string;
  durationMinutes: number;
  reward: number;
  plantedAt: string;
}

interface ImportRow {
  id: string | number;
}

/**
 * Importa energias legadas (arquivo localStorage antigo) para o banco, de forma
 * idempotente via legacy_key. Retorna quantas foram inseridas (0 se já havia).
 */
export async function importGardenEntries(profileId: string, entries: ImportGardenEntry[]): Promise<number> {
  parseProfileId(profileId);
  if (!Array.isArray(entries) || entries.length === 0) return 0;
  let inserted = 0;
  for (const e of entries) {
    if (!e || typeof e.legacyKey !== "string") continue;
    const energy = e.energyType && (GARDEN_ENERGY_TYPES as readonly string[]).includes(e.energyType) ? e.energyType : "flame";
    const minutes = Number.isFinite(Number(e.durationMinutes)) ? Math.max(0, Number(e.durationMinutes)) : 0;
    const reward = Number.isFinite(Number(e.reward)) ? Math.max(1, Number(e.reward)) : 1;
    const planted = e.plantedAt ? new Date(e.plantedAt) : new Date();
    const stamped = isNaN(planted.getTime()) ? new Date() : planted;
    const growthStage = getGrowthStage(minutes);
    const result = await pool.query<ImportRow>(
      `insert into garden_entries (profile_id, session_id, energy_type, duration_minutes, reward, planted_at, legacy_key, growth_stage, status)
       values ($1, null, $2, $3, $4, $5, $6, $7, 'alive')
       on conflict (profile_id, legacy_key) where legacy_key is not null do nothing
       returning id`,
      [profileId, energy, minutes, reward, stamped, e.legacyKey, growthStage],
    );
    if (result.rowCount && result.rowCount > 0) inserted += 1;
  }
  return inserted;
}

export async function plantGardenEntries(
  profileId: string,
  sessionId: number | null,
  energyType: string,
  durationMinutes: number,
  status: GardenStatus = "growing"
): Promise<void> {
  const reward = getEnergyReward(durationMinutes);
  if (reward <= 0 || durationMinutes <= 0) return;
  const perEnergy = Math.round((durationMinutes / reward) * 100) / 100;
  const growthStage = getGrowthStage(durationMinutes);
  const values: unknown[] = [];
  const placeholders: string[] = [];
  for (let i = 0; i < reward; i++) {
    placeholders.push(`($${values.length + 1}, $${values.length + 2}, $${values.length + 3}, $${values.length + 4}, $${values.length + 5}, $${values.length + 6}, $${values.length + 7})`);
    values.push(profileId, sessionId, energyType, perEnergy, reward, growthStage, status);
  }
  await pool.query(
    `insert into garden_entries (profile_id, session_id, energy_type, duration_minutes, reward, growth_stage, status) values ${placeholders.join(", ")}`,
    values,
  );
}

/** Update garden entries status and growth stage when a session is completed or abandoned */
export async function finalizeGardenEntries(
  profileId: string,
  sessionId: number,
  completed: boolean,
  actualDurationMinutes: number
): Promise<void> {
  parseProfileId(profileId);
  const newStatus = completed ? "alive" : "withered";
  const newGrowthStage = getGrowthStage(actualDurationMinutes);
  await pool.query(
    `update garden_entries
     set status = $1, growth_stage = $2, duration_minutes = $3
     where profile_id = $4 and session_id = $5 and status = 'growing'`,
    [newStatus, newGrowthStage, actualDurationMinutes, profileId, sessionId],
  );
}

interface FocusRow {
  id: string | number;
  profile_id: string;
  duration_minutes: number;
  target_duration_minutes: number;
  started_at: Date | string;
  ended_at: Date | string | null;
  task_id: string | number | null;
  xp_earned: number;
  energy_type?: string | null;
}

function mapFocus(row: FocusRow): FocusSession {
  return {
    id: Number(row.id),
    profileId: row.profile_id,
    durationMinutes: row.duration_minutes,
    targetDurationMinutes: row.target_duration_minutes ?? 25,
    startedAt: typeof row.started_at === "string" ? row.started_at : row.started_at.toISOString(),
    endedAt: row.ended_at ? (typeof row.ended_at === "string" ? row.ended_at : row.ended_at.toISOString()) : undefined,
    taskId: row.task_id ? Number(row.task_id) : undefined,
    xpEarned: row.xp_earned,
  };
}

export async function startFocusSession(
  profileId: string,
  targetDurationMinutes: number,
  taskId?: number,
  energyType?: string,
): Promise<FocusSession> {
  parseProfileId(profileId);
  if (!Number.isInteger(targetDurationMinutes) || targetDurationMinutes < 1 || targetDurationMinutes > FOCUS_DURATION_MAX_MINUTES) {
    throw new ValidationError("Duração inválida.");
  }
  const energy = energyType && (GARDEN_ENERGY_TYPES as readonly string[]).includes(energyType) ? energyType : null;
  const result = await pool.query<FocusRow>(
    `insert into focus_sessions (profile_id, task_id, duration_minutes, target_duration_minutes, energy_type) values ($1, $2, 0, $3, $4)
     returning id, profile_id, duration_minutes, target_duration_minutes, started_at, ended_at, task_id, xp_earned`,
    [profileId, taskId ?? null, targetDurationMinutes, energy],
  );
  const session = mapFocus(result.rows[0]);

  // Plant a seed in the garden immediately when session starts (if >= 10 min session)
  if (energy && targetDurationMinutes >= 10) {
    // Use the target duration for initial planting, will be updated on completion
    await plantGardenEntries(profileId, session.id, energy, targetDurationMinutes, "growing");
  }

  return session;
}

export async function endFocusSession(
  profileId: string,
  sessionId: number,
  focusedSeconds: number,
  isRoomSession: boolean = false,
): Promise<{ session: FocusSession; xpAwarded: number; coinsAwarded: number; questsUpdated: number }> {
  parseProfileId(profileId);
  if (!Number.isInteger(sessionId) || sessionId <= 0) throw new ValidationError("Sessão inválida.");
  if (!Number.isFinite(focusedSeconds) || focusedSeconds < 0) throw new ValidationError("Duração inválida.");

  const session = await pool.query<FocusRow>(
    `select id, profile_id, duration_minutes, target_duration_minutes, started_at, ended_at, task_id, xp_earned, energy_type
     from focus_sessions where profile_id = $1 and id = $2`,
    [profileId, sessionId],
  );
  if (!session.rows[0]) throw new NotFoundError("Sessão não encontrada.");

  // Idempotent: a repeated end (e.g. a focus room auto-completing a session
  // the client also tries to end, or a timer re-firing on a stale persisted
  // session) is not an error. Reward the already-finalized values exactly once.
  if (session.rows[0].ended_at) {
    const storedDuration = Math.max(0, Number(session.rows[0].duration_minutes) || 0);
    const coinsAwarded = Math.floor(storedDuration / 10) * FOCUS_COINS_PER_10_MIN;
    return {
      session: mapFocus(session.rows[0]),
      xpAwarded: Number(session.rows[0].xp_earned) || 0,
      coinsAwarded,
      questsUpdated: 0,
    };
  }

  // SECURITY: the reported duration is clamped server-side. A client could
  // otherwise claim hours of focus for a 25-minute session and farm XP/coins,
  // quest progress, streak, garden and group contributions. The cap is the
  // session's own target duration (the maximum legitimate reward).
  const targetCap = session.rows[0].target_duration_minutes
    ? Math.round(session.rows[0].target_duration_minutes)
    : FOCUS_DURATION_MAX_MINUTES;
  const durationMinutes = Math.max(1, Math.min(Math.round(focusedSeconds / 60), targetCap));
  const baseXP = Math.round(durationMinutes * FOCUS_XP_PER_MIN);
  const coins = Math.floor(durationMinutes / 10) * FOCUS_COINS_PER_10_MIN;
  // Coins stay at the base amount; XP may be doubled by an active 2x boost.
  const xpAwarded = baseXP > 0 ? await creditXP(profileId, "focus", sessionId, baseXP) : 0;

  const updated = await pool.query<FocusRow>(
    `update focus_sessions set duration_minutes = $3, ended_at = now(), xp_earned = $4
     where profile_id = $1 and id = $2
     returning id, profile_id, duration_minutes, target_duration_minutes, started_at, ended_at, task_id, xp_earned`,
    [profileId, sessionId, durationMinutes, xpAwarded],
  );

  if (coins > 0) {
    await addCoins(profileId, coins);
  }

  // Update daily missions via the shared metric hook. This replaces the old
  // hardcoded quest-id increments (1/2/3), which broke because mission row ids
  // are no longer fixed. Every completed session advances the SESSIONS_COMPLETED
  // and TOTAL_MINUTES metrics; room sessions additionally advance the
  // ROOM_SESSION_COMPLETED metric regardless of the assigned row ids.
  await recordMissionProgress(profileId, "SESSIONS_COMPLETED", { incrementBy: 1 });
  await recordMissionProgress(profileId, "TOTAL_MINUTES", { incrementBy: durationMinutes });

  if (isRoomSession) {
    await recordMissionProgress(profileId, "ROOM_SESSION_COMPLETED", { incrementBy: 1 });
  }

  if (durationMinutes >= 60) {
    await recordMissionProgress(profileId, "LONG_SESSION_60", { incrementBy: 1 });
  }

  // "Focus before 9am" is evaluated against the session start in the product TZ.
  const startedLocalHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: APP_TIMEZONE, hour: "numeric", hour12: false }).format(
      new Date(typeof session.rows[0].started_at === "string" ? session.rows[0].started_at : session.rows[0].started_at),
    ),
  );
  if (startedLocalHour < 9) {
    await recordMissionProgress(profileId, "EARLY_SESSION_9AM", { incrementBy: 1 });
  }

  // Real-time streak: a session that reached at least `STREAK_COMPLETION_THRESHOLD`
  // of its target duration counts as the day's "success" for streak purposes and
  // advances the streak immediately (first qualifying session of the day).
  // Given-up sessions (fewer focused minutes than the target) and abandoned ones
  // do not affect the streak.
  const targetMinutes = session.rows[0].target_duration_minutes ?? 0;
  const completedThreshold = targetMinutes * STREAK_COMPLETION_THRESHOLD;
  if (durationMinutes >= completedThreshold) {
    await onFocusSessionCompleted(profileId);
  }

  // Garden: finalize the energy(ies) that were planted when the session started.
  // Sessions that reached their target duration become "alive"; abandoned sessions
  // become "withered" — mirroring the streak qualification rule.
  const completed = durationMinutes >= completedThreshold;
  await finalizeGardenEntries(profileId, sessionId, completed, durationMinutes);

  // Record group focus contributions for leaderboard
  // Only record contributions for completed sessions that reached target duration
  if (durationMinutes >= completedThreshold) {
    const endedAt = updated.rows[0].ended_at;
    if (endedAt) {
      const completedAt = typeof endedAt === "string" 
        ? endedAt 
        : endedAt.toISOString();
      await recordGroupContribution(profileId, sessionId, durationMinutes, completedAt);
      // Fire-and-forget: check if any group milestone was crossed
      const groups = await pool.query<{ group_id: number }>(
        `select group_id from group_members where profile_id = $1`, [profileId]
      );
      for (const { group_id } of groups.rows) {
        checkAndUnlockMilestones(group_id).catch(() => {});
      }
    }
  }

  const questsUpdated = 1;
  return { session: mapFocus(updated.rows[0]), xpAwarded, coinsAwarded: coins, questsUpdated };
}

export async function getFocusHistory(profileId: string): Promise<FocusSession[]> {
  parseProfileId(profileId);
  const result = await pool.query<FocusRow>(
    `select id, profile_id, duration_minutes, target_duration_minutes, started_at, ended_at, task_id, xp_earned
     from focus_sessions where profile_id = $1 and ended_at is not null
     order by started_at desc limit 30`,
    [profileId],
  );
  return result.rows.map(mapFocus);
}

export async function getWeeklyFocusMinutesForProfiles(
  profileIds: string[],
  weekStart: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (profileIds.length === 0) return map;
  const result = await pool.query<{ profile_id: string; minutes: string | number }>(
    `select profile_id, coalesce(sum(duration_minutes), 0) as minutes
     from focus_sessions
     where profile_id = any($1::text[])
       and ended_at is not null
       and started_at >= ($2::date)::timestamp at time zone 'America/Sao_Paulo'
       and started_at < (($2::date + 7))::timestamp at time zone 'America/Sao_Paulo'
     group by profile_id`,
    [profileIds, weekStart],
  );
  for (const row of result.rows) map.set(row.profile_id, Number(row.minutes));
  for (const id of profileIds) if (!map.has(id)) map.set(id, 0);
  return map;
}

export async function getLifetimeFocusMinutes(profileId: string): Promise<number> {
  parseProfileId(profileId);
  const result = await pool.query<{ minutes: string | number }>(
    `select coalesce(sum(duration_minutes), 0) as minutes
     from focus_sessions where profile_id = $1 and ended_at is not null`,
    [profileId],
  );
  return Number(result.rows[0]?.minutes ?? 0);
}

export async function getLongestFocusSession(profileId: string): Promise<number> {
  parseProfileId(profileId);
  const result = await pool.query<{ minutes: string | number | null }>(
    `select max(duration_minutes) as minutes
     from focus_sessions where profile_id = $1 and ended_at is not null`,
    [profileId],
  );
  return Number(result.rows[0]?.minutes ?? 0);
}

export async function getTodayFocusStats(profileId: string): Promise<{ minutesFocused: number; coinsEarned: number }> {
  parseProfileId(profileId);
  const today = todayIso();
  const result = await pool.query<{ minutes: string | number; coins: string | number }>(
    `select coalesce(sum(duration_minutes), 0) as minutes,
            coalesce(sum(xp_earned), 0) as coins
     from focus_sessions where profile_id = $1 and ended_at is not null and started_at::date = $2::date`,
    [profileId, today],
  );
  return { minutesFocused: Number(result.rows[0]?.minutes ?? 0), coinsEarned: Number(result.rows[0]?.coins ?? 0) };
}
