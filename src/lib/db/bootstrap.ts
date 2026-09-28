/**
 * User Bootstrap Module
 * 
 * Ensures all required database rows exist for a user on first login or when needed.
 * This is the single source of truth for creating user-related rows.
 * 
 * Philosophy:
 * - Lazy creation: Only create rows when they're actually needed
 * - Idempotent: Safe to call multiple times
 * - Fail-safe: Never crash, return sensible defaults
 */

import pool from "../db";
import type { PoolClient } from "pg";
import { parseProfileId } from "./validation";
import { ensureProfile } from "./profiles";
import { getSettings, saveSettings, type SaveSettingsInput } from "./settings";
import { getUserXP } from "./xp";
import { ensureDefaultAuras } from "./store";
import { getOrCreateUserLeagueGroup } from "./league-new";

export interface BootstrapResult {
  profileCreated: boolean;
  settingsCreated: boolean;
  xpCreated: boolean;
  aurasCreated: boolean;
  leagueCreated: boolean;
}

/**
 * Ensures all core user rows exist in the database.
 * This is called lazily when a user accesses features that need these rows.
 * 
 * Creates:
 * - profiles row (if doesn't exist)
 * - user_settings row (if doesn't exist)
 * - user_xp row (if doesn't exist)
 * - user_auras rows for default auras (if doesn't exist)
 * - league_standings/league_entries rows (if doesn't exist)
 */
export async function ensureUserBootstrap(
  profileId: string,
  displayName?: string,
  email?: string,
  photoUrl?: string,
  db?: PoolClient,
): Promise<BootstrapResult> {
  parseProfileId(profileId);
  
  const client = db ?? pool;
  const result: BootstrapResult = {
    profileCreated: false,
    settingsCreated: false,
    xpCreated: false,
    aurasCreated: false,
    leagueCreated: false,
  };

  try {
    // 1. Ensure profile exists
    const profileCheck = await client.query<{ count: number }>(
      `select count(*)::int as count from profiles where id = $1`,
      [profileId],
    );
    const profileCount = profileCheck.rows[0]?.count ?? 0;
    if (profileCount === 0) {
      await ensureProfile(profileId, displayName, email, photoUrl);
      result.profileCreated = true;
    }

    // 2. Ensure settings exist
    const settingsCheck = await client.query<{ count: number }>(
      `select count(*)::int as count from user_settings where profile_id = $1`,
      [profileId],
    );
    const settingsCount = settingsCheck.rows[0]?.count ?? 0;
    if (settingsCount === 0) {
      // Create with defaults
      await client.query(
        `insert into user_settings (profile_id, notifications_enabled, preferred_theme, coins, sound_notifications_enabled, onboarding_completed, reminder_checkin_enabled, reminder_focus_enabled, reminder_sleep_enabled)
         values ($1, true, 'dark', 0, true, false, false, false, false)`,
        [profileId],
      );
      result.settingsCreated = true;
    }

    // 3. Ensure XP exists
    const xpCheck = await client.query<{ count: number }>(
      `select count(*)::int as count from user_xp where profile_id = $1`,
      [profileId],
    );
    if ((xpCheck.rows[0]?.count ?? 0) === 0) {
      await client.query(
        `insert into user_xp (profile_id, total_xp, level, updated_at)
         values ($1, 0, 1, now())`,
        [profileId],
      );
      result.xpCreated = true;
    }

    // 4. Ensure default auras exist
    const aurasCheck = await client.query<{ count: number }>(
      `select count(*)::int as count from user_auras where profile_id = $1`,
      [profileId],
    );
    if ((aurasCheck.rows[0]?.count ?? 0) === 0) {
      await client.query(
        `insert into user_auras (profile_id, aura_type, unlocked_at)
         values ($1, 'flame', now()), ($1, 'water', now())
         on conflict (profile_id, aura_type) do nothing`,
        [profileId],
      );
      result.aurasCreated = true;
    }

    // 5. Ensure league entries exist (this will create the current week's entry)
    const leagueCheck = await client.query<{ count: number }>(
      `select count(*)::int as count from league_standings where profile_id = $1`,
      [profileId],
    );
    if ((leagueCheck.rows[0]?.count ?? 0) === 0) {
      // Insert with default tier
      await client.query(
        `insert into league_standings (profile_id, current_tier)
         values ($1, 'faisca')
         on conflict (profile_id) do nothing`,
        [profileId],
      );
      result.leagueCreated = true;
    }

    // Trigger league group creation for current week
    try {
      await getOrCreateUserLeagueGroup(profileId);
      result.leagueCreated = true;
    } catch {
      // League group creation might fail if week hasn't started yet, that's okay
    }

    return result;
  } catch (error) {
    // Log but don't throw - bootstrap should be fail-safe
    console.error("[bootstrap] Error ensuring user data:", error);
    return result;
  }
}

/**
 * Quick bootstrap check - returns true if all core rows exist for a user.
 * Useful for debugging or conditional logic.
 */
export async function isUserBootstrapped(profileId: string): Promise<boolean> {
  parseProfileId(profileId);
  
  const [profile, settings, xp, auras, league] = await Promise.all([
    pool.query<{ count: number }>(`select count(*)::int as count from profiles where id = $1`, [profileId]),
    pool.query<{ count: number }>(`select count(*)::int as count from user_settings where profile_id = $1`, [profileId]),
    pool.query<{ count: number }>(`select count(*)::int as count from user_xp where profile_id = $1`, [profileId]),
    pool.query<{ count: number }>(`select count(*)::int as count from user_auras where profile_id = $1`, [profileId]),
    pool.query<{ count: number }>(`select count(*)::int as count from league_standings where profile_id = $1`, [profileId]),
  ]);
  
  return [
    profile.rows[0]?.count > 0,
    settings.rows[0]?.count > 0,
    xp.rows[0]?.count > 0,
    auras.rows[0]?.count > 0,
    league.rows[0]?.count > 0,
  ].every(Boolean);
}

/**
 * Helper to safely get a row, returning null if not found.
 * Use this instead of direct queries when you need to handle missing rows.
 */
export async function getRowSafe<T>(
  query: string,
  params: unknown[],
  mapper?: (row: unknown) => T,
): Promise<T | null> {
  const result = await pool.query(query, params);
  if (!result.rows[0]) return null;
  return mapper ? mapper(result.rows[0]) : (result.rows[0] as unknown as T);
}

/**
 * Helper to safely get a count, returning 0 if no results.
 * Use this for aggregations that might return null.
 */
export async function getCountSafe(query: string, params: unknown[]): Promise<number> {
  const result = await pool.query<{ count: number }>(query, params);
  return Number(result.rows[0]?.count ?? 0);
}

/**
 * Helper to safely get a sum, returning 0 if null.
 * Use this for SUM aggregations that might return null.
 */
export async function getSumSafe(query: string, params: unknown[]): Promise<number> {
  const result = await pool.query<{ sum: number | null }>(query, params);
  return Number(result.rows[0]?.sum ?? 0);
}
