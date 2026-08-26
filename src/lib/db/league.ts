import pool from "../db";
import type { LeagueEntry, LeagueResult, LeagueSnapshot, LeagueTier } from "@/types";
import { parseProfileId } from "./validation";
import { leagueResetAtIso, sundayWeekStartIso, todayIso } from "./dates";
import { getWeeklyFocusMinutesForProfiles } from "./focus";
import { acceptedFriendIds } from "./social";
import { unlockRarestAura } from "./achievements";

export const LEAGUE_TIERS: LeagueTier[] = ["faisca", "chama", "aura", "nucleo"];

export const TIER_META: Record<LeagueTier, { label: string; color: string; glow: string; next?: LeagueTier; prev?: LeagueTier }> = {
  faisca: { label: "Faísca", color: "#c47a4a", glow: "rgba(196,122,74,.45)", next: "chama" },
  chama: { label: "Chama", color: "#ffb86b", glow: "rgba(255,184,107,.45)", next: "aura", prev: "faisca" },
  aura: { label: "Aura", color: "#ffd76b", glow: "rgba(255,215,107,.5)", next: "nucleo", prev: "chama" },
  nucleo: { label: "Núcleo", color: "#71d4ff", glow: "rgba(113,212,255,.55)", prev: "aura" },
};

export function xpFromMinutes(minutes: number, streak: number): number {
  const multiplier = 1 + Math.min(Math.max(streak, 0), 30) * 0.02;
  return Math.round(Math.max(0, minutes) * multiplier);
}

function zoneCounts(n: number): { promo: number; demo: number } {
  if (n <= 2) return { promo: 0, demo: 0 };
  if (n < 10) {
    const promo = n >= 3 ? 1 : 0;
    const demo = n >= 5 ? 1 : 0;
    return { promo, demo };
  }
  return { promo: 5, demo: 5 };
}

async function ensureStanding(profileId: string): Promise<LeagueTier> {
  const result = await pool.query<{ current_tier: LeagueTier }>(
    `insert into league_standings (profile_id, current_tier)
     values ($1, 'faisca')
     on conflict (profile_id) do update set profile_id = league_standings.profile_id
     returning current_tier`,
    [profileId],
  );
  return result.rows[0].current_tier;
}

async function ensureCurrentEntry(profileId: string, weekStart: string, tier: LeagueTier): Promise<void> {
  await pool.query(
    `insert into league_entries (profile_id, week_start, tier, xp)
     values ($1, $2, $3, 0)
     on conflict (profile_id, week_start) do nothing`,
    [profileId, weekStart, tier],
  );
}

export async function rolloverIfNeeded(now = new Date()): Promise<boolean> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  const currentWeek = sundayWeekStartIso(today);

  const latest = await pool.query<{ week_start: Date | string }>(
    `select week_start from league_entries order by week_start desc limit 1`,
  );
  if (!latest.rows[0]) return false;

  const latestWeek =
    typeof latest.rows[0].week_start === "string"
      ? latest.rows[0].week_start.slice(0, 10)
      : latest.rows[0].week_start.toISOString().slice(0, 10);

  if (latestWeek >= currentWeek) return false;

  await finalizeWeek(latestWeek, currentWeek);
  return true;
}

async function finalizeWeek(oldWeek: string, newWeek: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("begin");

    const standings = await client.query<{ profile_id: string; current_tier: LeagueTier }>(
      `select profile_id, current_tier from league_standings`,
    );
    const ids = standings.rows.map((row) => row.profile_id);
    const minutes = await getWeeklyFocusMinutesForProfiles(ids, oldWeek);
    const streaks = await client.query<{ id: string; current_streak: number }>(
      `select id, current_streak from profiles where id = any($1::text[])`,
      [ids],
    );
    const streakMap = new Map(streaks.rows.map((row) => [row.id, row.current_streak]));

    for (const row of standings.rows) {
      const xp = xpFromMinutes(minutes.get(row.profile_id) ?? 0, streakMap.get(row.profile_id) ?? 0);
      await client.query(
        `insert into league_entries (profile_id, week_start, tier, xp)
         values ($1, $2, $3, $4)
         on conflict (profile_id, week_start) do update set xp = excluded.xp, tier = excluded.tier`,
        [row.profile_id, oldWeek, row.current_tier, xp],
      );
    }

    for (const tier of LEAGUE_TIERS) {
      const ranked = await client.query<{ profile_id: string; xp: number }>(
        `select profile_id, xp from league_entries
         where week_start = $1 and tier = $2
         order by xp desc, profile_id asc`,
        [oldWeek, tier],
      );

      const n = ranked.rows.length;
      const { promo, demo } = zoneCounts(n);
      const meta = TIER_META[tier];

      for (let i = 0; i < n; i += 1) {
        const profileId = ranked.rows[i].profile_id;
        const rank = i + 1;
        let result: LeagueResult = "stayed";
        let nextTier: LeagueTier = tier;

        if (promo > 0 && rank <= promo && meta.next) {
          result = "promoted";
          nextTier = meta.next;
        } else if (demo > 0 && rank > n - demo && meta.prev) {
          result = "demoted";
          nextTier = meta.prev;
        }

        await client.query(
          `update league_entries set rank = $3 where profile_id = $1 and week_start = $2`,
          [profileId, oldWeek, rank],
        );
        await client.query(
          `update league_standings
           set current_tier = $2, last_week_rank = $3, last_week_result = $4
           where profile_id = $1`,
          [profileId, nextTier, rank, result],
        );
        await client.query(
          `insert into league_entries (profile_id, week_start, tier, xp)
           values ($1, $2, $3, 0)
           on conflict (profile_id, week_start) do nothing`,
          [profileId, newWeek, nextTier],
        );

        if (tier === "nucleo" && rank === 1) {
          await unlockRarestAura(profileId);
        }
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getLeagueSnapshot(profileId: string): Promise<LeagueSnapshot> {
  parseProfileId(profileId);
  await rolloverIfNeeded();

  const weekStart = sundayWeekStartIso(todayIso());
  const tier = await ensureStanding(profileId);
  await ensureCurrentEntry(profileId, weekStart, tier);

  const standing = await pool.query<{
    current_tier: LeagueTier;
    last_week_rank: number | null;
    last_week_result: LeagueResult | null;
  }>(
    `select current_tier, last_week_rank, last_week_result from league_standings where profile_id = $1`,
    [profileId],
  );

  const currentTier = standing.rows[0]?.current_tier ?? "faisca";
  const peers = await pool.query<{
    profile_id: string;
    display_name: string;
    username: string | null;
    photo_url: string | null;
    current_streak: number | null;
  }>(
    `select p.id as profile_id, p.display_name, p.username, p.photo_url, p.current_streak
     from league_standings s
     join profiles p on p.id = s.profile_id
     where s.current_tier = $1`,
    [currentTier],
  );

  const ids = peers.rows.map((row) => row.profile_id);
  const minutes = await getWeeklyFocusMinutesForProfiles(ids, weekStart);
  const friendIds = new Set(await acceptedFriendIds(profileId));

  const ranked: LeagueEntry[] = peers.rows
    .map((row) => ({
      profileId: row.profile_id,
      displayName: row.display_name,
      username: row.username ?? undefined,
      photoUrl: row.photo_url ?? undefined,
      xp: xpFromMinutes(minutes.get(row.profile_id) ?? 0, row.current_streak ?? 0),
      rank: 0,
      currentStreak: row.current_streak ?? 0,
      isCurrentUser: row.profile_id === profileId,
      isFriend: friendIds.has(row.profile_id),
    }))
    .sort((a, b) => b.xp - a.xp || a.displayName.localeCompare(b.displayName))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const n = ranked.length;
  const { promo, demo } = zoneCounts(n);
  const meta = TIER_META[currentTier];
  const promotionUntilRank = meta.next && promo > 0 ? promo : null;
  const demotionFromRank = meta.prev && demo > 0 ? n - demo + 1 : null;

  return {
    tier: currentTier,
    weekStart,
    resetsAt: leagueResetAtIso(),
    entries: ranked,
    promotionUntilRank,
    demotionFromRank,
    lastWeekResult: standing.rows[0]?.last_week_result ?? undefined,
    lastWeekRank: standing.rows[0]?.last_week_rank ?? undefined,
  };
}

export async function runWeeklyReset(): Promise<{ rolled: boolean }> {
  const rolled = await rolloverIfNeeded();
  return { rolled };
}
