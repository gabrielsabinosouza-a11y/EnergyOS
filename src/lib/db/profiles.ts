import pool from "../db";
import type { User } from "@/types";
import { NotFoundError } from "../errors";
import { parseProfileId, parseTitle, ValidationError } from "./validation";

interface ProfileRow {
  id: string;
  display_name: string;
  email: string | null;
  username: string | null;
  photo_url: string | null;
  created_at: Date | string;
  last_active_at: Date | string | null;
  current_streak: number | null;
  longest_streak: number | null;
  role: string | null;
  equipped_decoration_id: string | null;
  equipped_shield_design_id: string | null;
  has_custom_banner: boolean | null;
  banner_image_url: string | null;
  featured_achievements: string[] | null;
}

const PROFILE_COLUMNS = `id, display_name, email, username, photo_url, created_at, last_active_at, current_streak, longest_streak, role, equipped_decoration_id, equipped_shield_design_id, has_custom_banner, banner_image_url, featured_achievements`;

function mapToUser(row: ProfileRow): User {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email ?? "",
    username: row.username ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    lastActiveAt: row.last_active_at ? new Date(row.last_active_at).toISOString() : undefined,
    currentStreak: row.current_streak ?? 0,
    longestStreak: row.longest_streak ?? 0,
    role: (row.role as "user" | "admin" | undefined) ?? "user",
    equippedDecorationId: row.equipped_decoration_id ?? undefined,
    equippedShieldDesignId: row.equipped_shield_design_id ?? undefined,
    hasCustomBanner: row.has_custom_banner ?? false,
    bannerImageUrl: row.banner_image_url ?? undefined,
    featuredAchievementIds: row.featured_achievements ?? undefined,
  };
}

export async function updateFeaturedAchievements(profileId: string, achievementIds: string[]): Promise<User> {
  parseProfileId(profileId);
  const ids = [...new Set(achievementIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length > 6) throw new ValidationError("Você pode destacar no máximo 6 conquistas.");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const unlocked = await client.query<{ achievement_id: string }>(
      `select achievement_id from user_achievement_progress
       where profile_id = $1 and unlocked_tier > 0 and achievement_id = any($2::text[])`,
      [profileId, ids],
    );
    const unlockedIds = new Set(unlocked.rows.map((row) => row.achievement_id));
    if (unlockedIds.size !== ids.length) {
      throw new ValidationError("Só é possível destacar conquistas desbloqueadas.");
    }
    await client.query(
      `update profiles set featured_achievements = $2::text[] where id = $1`,
      [profileId, ids],
    );
    await client.query(
      `update user_achievement_progress
       set is_featured = false, featured_order = null
       where profile_id = $1`,
      [profileId],
    );
    for (const [index, id] of ids.entries()) {
      await client.query(
        `update user_achievement_progress
         set is_featured = true, featured_order = $3
         where profile_id = $1 and achievement_id = $2`,
        [profileId, id, index + 1],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return getProfile(profileId);
}

function slugifyName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 16);
  return slug || "energia";
}

async function assignUsernameIfMissing(profileId: string, displayName: string): Promise<void> {
  const existing = await pool.query<{ username: string | null }>(
    `select username from profiles where id = $1`,
    [profileId],
  );
  if (existing.rows[0]?.username) return;

  const base = slugifyName(displayName);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      const updated = await pool.query(
        `update profiles set username = $2 where id = $1 and username is null`,
        [profileId, candidate],
      );
      if ((updated.rowCount ?? 0) > 0) return;
      return;
    } catch {
      // unique violation — try another suffix
    }
  }
}

export async function ensureProfile(
  profileId: string,
  displayName?: string,
  email?: string,
  photoUrl?: string,
): Promise<void> {
  parseProfileId(profileId);
  const name = displayName?.trim() ?? "";
  await pool.query(
    `insert into profiles (id, display_name, email, photo_url, last_active_at)
     values ($1, $2, $3, $4, now())
     on conflict (id) do update set
       display_name = coalesce(nullif(excluded.display_name, ''), profiles.display_name),
       email = coalesce(excluded.email, profiles.email),
       photo_url = coalesce(excluded.photo_url, profiles.photo_url),
       last_active_at = now()`,
    [profileId, name, email ?? null, photoUrl ?? null],
  );
  await assignUsernameIfMissing(profileId, name);
}

export async function getProfile(profileId: string): Promise<User> {
  parseProfileId(profileId);
  const result = await pool.query<ProfileRow>(
    `select ${PROFILE_COLUMNS} from profiles where id = $1`,
    [profileId],
  );
  if (!result.rows[0]) {
    throw new NotFoundError("Perfil não encontrado.");
  }
  return mapToUser(result.rows[0]);
}

export async function upsertAndGetProfile(
  profileId: string,
  displayName?: string,
  email?: string,
  photoUrl?: string,
): Promise<User> {
  await ensureProfile(profileId, displayName, email, photoUrl);
  return getProfile(profileId);
}

export async function updateDisplayName(profileId: string, displayName: string): Promise<User> {
  parseProfileId(profileId);
  const name = parseTitle(displayName, "Nome");
  const result = await pool.query<ProfileRow>(
    `update profiles set display_name = $2 where id = $1
     returning ${PROFILE_COLUMNS}`,
    [profileId, name],
  );
  if (!result.rows[0]) throw new NotFoundError("Perfil não encontrado.");
  return mapToUser(result.rows[0]);
}

export async function updatePhotoUrl(profileId: string, photoUrl: string): Promise<User> {
  parseProfileId(profileId);
  if (!photoUrl) throw new ValidationError("URL da foto inválida.");
  if (photoUrl.startsWith("data:image/")) {
    if (photoUrl.length > 9_400_000) throw new ValidationError("Imagem muito grande (máx. ~7 MB).");
  } else if (photoUrl.length > 2000) {
    throw new ValidationError("URL da foto inválida.");
  }
  const result = await pool.query<ProfileRow>(
    `update profiles set photo_url = $2 where id = $1
     returning ${PROFILE_COLUMNS}`,
    [profileId, photoUrl],
  );
  if (!result.rows[0]) throw new NotFoundError("Perfil não encontrado.");
  return mapToUser(result.rows[0]);
}

export async function updateUsername(profileId: string, username: string): Promise<User> {
  parseProfileId(profileId);
  const trimmed = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(trimmed)) {
    throw new ValidationError("Username deve ter 3–20 caracteres (letras, números ou _).");
  }
  try {
    const result = await pool.query<ProfileRow>(
      `update profiles set username = $2 where id = $1
       returning ${PROFILE_COLUMNS}`,
      [profileId, trimmed],
    );
    if (!result.rows[0]) throw new NotFoundError("Perfil não encontrado.");
    return mapToUser(result.rows[0]);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") throw new ValidationError("Este username já está em uso.");
    throw error;
  }
}

const lastTouch = new Map<string, number>();
const TOUCH_TTL_MS = 5 * 60 * 1000;

export function touchLastActive(profileId: string): void {
  const now = Date.now();
  const prev = lastTouch.get(profileId) ?? 0;
  if (now - prev < TOUCH_TTL_MS) return;
  lastTouch.set(profileId, now);
  void pool.query(`update profiles set last_active_at = now() where id = $1`, [profileId]).catch(() => undefined);
}

export async function getUserRole(profileId: string): Promise<"user" | "admin"> {
  parseProfileId(profileId);
  const result = await pool.query<{ role: string | null }>(
    `select role from profiles where id = $1`,
    [profileId],
  );
  // A missing row defaults to "user" instead of failing auth, so the profile
  // can be provisioned on the first request (e.g. /api/dashboard, /api/profile)
  // instead of being permanently unreachable.
  return (result.rows[0]?.role as "user" | "admin") ?? "user";
}
