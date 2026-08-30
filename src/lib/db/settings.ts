import type { Pool, PoolClient } from "pg";
import pool from "../db";
import type { UserSettings } from "@/types";
import { ensureProfile } from "./profiles";
import { ValidationError, parseBoolean, parseEnum, parseOptionalTime, parseProfileId } from "./validation";

const THEMES = ["system", "light", "dark"] as const;

interface SettingsRow {
  notifications_enabled: boolean;
  preferred_theme: UserSettings["preferredTheme"];
  sleep_time: string | null;
  focus_time: string | null;
  coins: number;
}

function toSettings(profileId: string, row: SettingsRow): UserSettings {
  return {
    profileId,
    notificationsEnabled: row.notifications_enabled,
    preferredTheme: row.preferred_theme,
    sleepTime: row.sleep_time ? row.sleep_time.slice(0, 5) : undefined,
    focusTime: row.focus_time ? row.focus_time.slice(0, 5) : undefined,
    coins: row.coins ?? 0,
  };
}

export async function getSettings(profileId: string): Promise<UserSettings> {
  parseProfileId(profileId);
  const result = await pool.query<SettingsRow>(
    `select notifications_enabled, preferred_theme, sleep_time, focus_time, coins
     from user_settings where profile_id = $1`,
    [profileId],
  );
  if (!result.rows[0]) {
    return { profileId, notificationsEnabled: true, preferredTheme: "dark", coins: 0 };
  }
  return toSettings(profileId, result.rows[0]);
}

export interface SaveSettingsInput {
  notificationsEnabled?: boolean;
  preferredTheme?: UserSettings["preferredTheme"];
  sleepTime?: string | null;
  focusTime?: string | null;
}

export async function saveSettings(profileId: string, input: SaveSettingsInput): Promise<UserSettings> {
  parseProfileId(profileId);
  await ensureProfile(profileId);

  const notificationsEnabled = parseBoolean(input.notificationsEnabled ?? true, "Notificações", true);
  const preferredTheme = parseEnum(input.preferredTheme ?? "dark", THEMES, "Tema");
  const sleepTime = input.sleepTime === undefined ? null : parseOptionalTime(input.sleepTime, "Horário de sono");
  const focusTime = input.focusTime === undefined ? null : parseOptionalTime(input.focusTime, "Horário de foco");

  const result = await pool.query<SettingsRow>(
    `insert into user_settings (profile_id, notifications_enabled, preferred_theme, sleep_time, focus_time)
     values ($1, $2, $3, $4, $5)
     on conflict (profile_id) do update set
       notifications_enabled = excluded.notifications_enabled,
       preferred_theme = excluded.preferred_theme,
       sleep_time = excluded.sleep_time,
       focus_time = excluded.focus_time
     returning notifications_enabled, preferred_theme, sleep_time, focus_time, coins`,
    [profileId, notificationsEnabled, preferredTheme, sleepTime, focusTime],
  );
  return toSettings(profileId, result.rows[0]);
}

// Helper to add coins (used by quest claiming).
// Upserts the settings row so users without a saved settings row can still earn coins.
export async function addCoins(profileId: string, amount: number, db: Pool | PoolClient = pool): Promise<UserSettings> {
  parseProfileId(profileId);
  const result = await db.query<SettingsRow>(
    `insert into user_settings (profile_id, notifications_enabled, preferred_theme, sleep_time, focus_time, coins)
     values ($1, true, 'dark', null, null, $2)
     on conflict (profile_id) do update set coins = user_settings.coins + excluded.coins
     returning notifications_enabled, preferred_theme, sleep_time, focus_time, coins`,
    [profileId, amount],
  );
  return toSettings(profileId, result.rows[0]);
}
