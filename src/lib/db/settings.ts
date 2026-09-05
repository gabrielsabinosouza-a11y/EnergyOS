import type { Pool, PoolClient } from "pg";
import pool from "../db";
import type { UserSettings } from "@/types";
import { ensureProfile } from "./profiles";
import { ValidationError, parseBoolean, parseEnum, parseOptionalTime, parseProfileId } from "./validation";
import { ENERGY_TYPES } from "@/lib/energy-assets";

const THEMES = ["system", "light", "dark"] as const;

interface SettingsRow {
  notifications_enabled: boolean;
  preferred_theme: UserSettings["preferredTheme"];
  sleep_time: string | null;
  focus_time: string | null;
  coins: number;
  sound_notifications_enabled: boolean;
  last_selected_aura: string | null;
}

function toSettings(profileId: string, row: SettingsRow): UserSettings {
  return {
    profileId,
    notificationsEnabled: row.notifications_enabled,
    preferredTheme: row.preferred_theme,
    sleepTime: row.sleep_time ? row.sleep_time.slice(0, 5) : undefined,
    focusTime: row.focus_time ? row.focus_time.slice(0, 5) : undefined,
    coins: row.coins ?? 0,
    soundNotificationsEnabled: row.sound_notifications_enabled,
    lastSelectedAura: row.last_selected_aura ?? undefined,
  };
}

export async function getSettings(profileId: string): Promise<UserSettings> {
  parseProfileId(profileId);
  const result = await pool.query<SettingsRow>(
    `select notifications_enabled, preferred_theme, sleep_time, focus_time, coins, sound_notifications_enabled, last_selected_aura
     from user_settings where profile_id = $1`,
    [profileId],
  );
  if (!result.rows[0]) {
    return { profileId, notificationsEnabled: true, preferredTheme: "dark", coins: 0, soundNotificationsEnabled: true };
  }
  return toSettings(profileId, result.rows[0]);
}

export interface SaveSettingsInput {
  notificationsEnabled?: boolean;
  preferredTheme?: UserSettings["preferredTheme"];
  sleepTime?: string | null;
  focusTime?: string | null;
  soundNotificationsEnabled?: boolean;
}

export async function saveSettings(profileId: string, input: SaveSettingsInput): Promise<UserSettings> {
  parseProfileId(profileId);
  await ensureProfile(profileId);

  const notificationsEnabled = parseBoolean(input.notificationsEnabled ?? true, "Notificações", true);
  const preferredTheme = parseEnum(input.preferredTheme ?? "dark", THEMES, "Tema");
  const sleepTime = input.sleepTime === undefined ? null : parseOptionalTime(input.sleepTime, "Horário de sono");
  const focusTime = input.focusTime === undefined ? null : parseOptionalTime(input.focusTime, "Horário de foco");
  const soundNotificationsEnabled = parseBoolean(input.soundNotificationsEnabled ?? true, "Sons de notificação", true);

  const result = await pool.query<SettingsRow>(
    `insert into user_settings (profile_id, notifications_enabled, preferred_theme, sleep_time, focus_time, sound_notifications_enabled)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (profile_id) do update set
       notifications_enabled = excluded.notifications_enabled,
       preferred_theme = excluded.preferred_theme,
       sleep_time = excluded.sleep_time,
       focus_time = excluded.focus_time,
       sound_notifications_enabled = excluded.sound_notifications_enabled
     returning notifications_enabled, preferred_theme, sleep_time, focus_time, coins, sound_notifications_enabled, last_selected_aura`,
    [profileId, notificationsEnabled, preferredTheme, sleepTime, focusTime, soundNotificationsEnabled],
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
     returning notifications_enabled, preferred_theme, sleep_time, focus_time, coins, sound_notifications_enabled, last_selected_aura`,
    [profileId, amount],
  );
  return toSettings(profileId, result.rows[0]);
}

/**
 * Persiste a aura/energia que o usuário escolheu por último para sessões de
 * foco — um update pontual que NÃO mexe nas demais preferências (diferente do
 * saveSettings, que faz upsert completo). Rejeita valores fora do conjunto
 * conhecido de auras.
 */
export async function setLastSelectedAura(profileId: string, auraType: string | null): Promise<UserSettings> {
  parseProfileId(profileId);
  if (auraType !== null && !(ENERGY_TYPES as readonly string[]).includes(auraType)) {
    throw new ValidationError("Energia inválida.");
  }
  await ensureProfile(profileId);
  const result = await pool.query<SettingsRow>(
    `insert into user_settings (profile_id, last_selected_aura)
     values ($1, $2)
     on conflict (profile_id) do update set last_selected_aura = excluded.last_selected_aura
     returning notifications_enabled, preferred_theme, sleep_time, focus_time, coins, sound_notifications_enabled, last_selected_aura`,
    [profileId, auraType],
  );
  return toSettings(profileId, result.rows[0]);
}
