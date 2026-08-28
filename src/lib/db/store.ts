import pool from "../db";
import type { AvatarDecoration, DecorationRarity, MonthlyRecap, StoreItem, UserDecoration } from "@/types";
import { NotFoundError, ConflictError, ForbiddenError } from "../errors";
import { ValidationError, parseProfileId } from "./validation";

const RARITY_ORDER: Record<DecorationRarity, number> = {
  common: 0, rare: 1, epic: 2, legendary: 3,
};

// ── Decorations ────────────────────────────────────────────────────────────

export async function listDecorations(): Promise<AvatarDecoration[]> {
  const result = await pool.query<{
    id: string; name: string; description: string; image_url: string;
    price: number; rarity: DecorationRarity; sort_order: number;
  }>(
    `select id, name, description, image_url, price, rarity, sort_order
     from avatar_decorations where is_active = true order by sort_order asc`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    price: row.price,
    rarity: row.rarity,
    sortOrder: row.sort_order,
  }));
}

export async function getUserDecorations(profileId: string): Promise<UserDecoration[]> {
  parseProfileId(profileId);
  const result = await pool.query<{ decoration_id: string; purchased_at: Date | string }>(
    `select decoration_id, purchased_at from user_decorations where profile_id = $1`,
    [profileId],
  );
  return result.rows.map((row) => ({
    decorationId: row.decoration_id,
    purchasedAt: new Date(row.purchased_at).toISOString(),
  }));
}

export async function getEquippedDecorationId(profileId: string): Promise<string | null> {
  parseProfileId(profileId);
  const result = await pool.query<{ equipped_decoration_id: string | null }>(
    `select equipped_decoration_id from profiles where id = $1`,
    [profileId],
  );
  return result.rows[0]?.equipped_decoration_id ?? null;
}

export async function purchaseDecoration(
  profileId: string,
  decorationId: string,
): Promise<{ balance: number }> {
  parseProfileId(profileId);

  const decoration = await pool.query<{ price: number }>(
    `select price from avatar_decorations where id = $1 and is_active = true`,
    [decorationId],
  );
  if (!decoration.rows[0]) throw new NotFoundError("Decoração não encontrada.");

  const alreadyOwned = await pool.query(
    `select 1 from user_decorations where profile_id = $1 and decoration_id = $2`,
    [profileId, decorationId],
  );
  if (alreadyOwned.rows[0]) throw new ConflictError("Você já possui esta decoração.");

  const balance = await getCoinBalance(profileId);
  if (balance < decoration.rows[0].price) {
    throw new ForbiddenError("Moedas insuficientes.");
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `update user_settings set coins = coins - $1 where profile_id = $2`,
      [decoration.rows[0].price, profileId],
    );
    await client.query(
      `insert into user_decorations (profile_id, decoration_id) values ($1, $2) on conflict do nothing`,
      [profileId, decorationId],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return { balance: balance - decoration.rows[0].price };
}

export async function equipDecoration(
  profileId: string,
  decorationId: string | null,
): Promise<void> {
  parseProfileId(profileId);
  if (decorationId) {
    const owned = await pool.query(
      `select 1 from user_decorations where profile_id = $1 and decoration_id = $2`,
      [profileId, decorationId],
    );
    if (!owned.rows[0]) throw new ForbiddenError("Você não possui esta decoração.");
  }
  const result = await pool.query(
    `update profiles set equipped_decoration_id = $2 where id = $1`,
    [profileId, decorationId],
  );
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Perfil não encontrado.");
}

// ── Banner ─────────────────────────────────────────────────────────────────

const BANNER_COST = 1500;

export async function getBannerStatus(profileId: string): Promise<{
  hasCustomBanner: boolean;
  bannerImageUrl: string | null;
  unlocked: boolean;
}> {
  parseProfileId(profileId);
  const result = await pool.query<{
    has_custom_banner: boolean;
    banner_image_url: string | null;
  }>(
    `select has_custom_banner, banner_image_url from profiles where id = $1`,
    [profileId],
  );
  const row = result.rows[0];
  if (!row) throw new NotFoundError("Perfil não encontrado.");
  return {
    hasCustomBanner: row.has_custom_banner,
    bannerImageUrl: row.banner_image_url,
    unlocked: row.has_custom_banner,
  };
}

export async function unlockBanner(profileId: string): Promise<{ balance: number }> {
  parseProfileId(profileId);

  const profile = await pool.query<{ has_custom_banner: boolean }>(
    `select has_custom_banner from profiles where id = $1`,
    [profileId],
  );
  if (!profile.rows[0]) throw new NotFoundError("Perfil não encontrado.");
  if (profile.rows[0].has_custom_banner) {
    throw new ConflictError("Banner já desbloqueado.");
  }

  const balance = await getCoinBalance(profileId);
  if (balance < BANNER_COST) throw new ForbiddenError("Moedas insuficientes.");

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `update user_settings set coins = coins - $1 where profile_id = $2`,
      [BANNER_COST, profileId],
    );
    await client.query(
      `update profiles set has_custom_banner = true where id = $1`,
      [profileId],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return { balance: balance - BANNER_COST };
}

export async function updateBannerImage(
  profileId: string,
  imageUrl: string,
): Promise<void> {
  parseProfileId(profileId);
  if (!imageUrl || imageUrl.length > 2000) throw new ValidationError("URL do banner inválida.");
  const result = await pool.query(
    `update profiles set banner_image_url = $2 where id = $1 and has_custom_banner = true`,
    [profileId, imageUrl],
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new ForbiddenError("Banner não desbloqueado ou perfil não encontrado.");
  }
}

// ── Streak Shields ─────────────────────────────────────────────────────────

const SHIELD_COST = 200;
const MAX_SHIELDS = 3;

export async function getShieldCount(profileId: string): Promise<number> {
  parseProfileId(profileId);
  const result = await pool.query<{ streak_shield_count: number }>(
    `select streak_shield_count from profiles where id = $1`,
    [profileId],
  );
  return result.rows[0]?.streak_shield_count ?? 0;
}

export async function purchaseShield(profileId: string): Promise<{ balance: number; shieldCount: number }> {
  parseProfileId(profileId);

  const current = await getShieldCount(profileId);
  if (current >= MAX_SHIELDS) {
    throw new ConflictError(`Você já possui o máximo de ${MAX_SHIELDS} escudos.`);
  }

  const balance = await getCoinBalance(profileId);
  if (balance < SHIELD_COST) throw new ForbiddenError("Moedas insuficientes.");

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `update user_settings set coins = coins - $1 where profile_id = $2`,
      [SHIELD_COST, profileId],
    );
    await client.query(
      `update profiles set streak_shield_count = streak_shield_count + 1 where id = $1`,
      [profileId],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return { balance: balance - SHIELD_COST, shieldCount: current + 1 };
}

export async function isDayProtected(profileId: string, date: string): Promise<boolean> {
  parseProfileId(profileId);
  const res = await pool.query(
    `select 1 from streak_shield_usage where profile_id = $1 and used_on_date = $2`,
    [profileId, date],
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Idempotently consumes one streak shield to protect a specific missed day.
 *
 * Returns `true` only when a shield was actually consumed for `missedDate`.
 * If that day was already protected (or the user has no shields), no shield is
 * spent. This guards against a single missed day eating multiple shields on
 * repeated streak evaluations.
 */
export async function consumeShield(
  profileId: string,
  missedDate: string,
  streakValue: number,
): Promise<boolean> {
  parseProfileId(profileId);
  if (await isDayProtected(profileId, missedDate)) return false;

  const client = await pool.connect();
  try {
    await client.query("begin");

    // Insert the protection marker first; `on conflict do nothing` reports
    // whether this date was already protected by an earlier evaluation.
    const marker = await client.query(
      `insert into streak_shield_usage (profile_id, used_on_date, streak_value_at_use)
       values ($1, $2, $3) on conflict do nothing`,
      [profileId, missedDate, streakValue],
    );
    if ((marker.rowCount ?? 0) === 0) {
      await client.query("rollback");
      return false;
    }

    const updated = await client.query(
      `update profiles set streak_shield_count = streak_shield_count - 1
       where id = $1 and streak_shield_count > 0
       returning streak_shield_count`,
      [profileId],
    );
    if ((updated.rowCount ?? 0) === 0) {
      // No shields left even though the marker succeeded (edge case) — undo marker.
      await client.query("rollback");
      return false;
    }

    await client.query(
      `insert into streak_day_log (profile_id, log_date, status)
       values ($1, $2, 'protected')
       on conflict (profile_id, log_date) do update set status = 'protected'`,
      [profileId, missedDate],
    );
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function logStreakDay(
  profileId: string,
  date: string,
  status: "success" | "protected" | "lost",
): Promise<void> {
  parseProfileId(profileId);
  await pool.query(
    `insert into streak_day_log (profile_id, log_date, status)
     values ($1, $2, $3)
     on conflict (profile_id, log_date) do update set status = $3`,
    [profileId, date, status],
  );
}

// ── Auras ──────────────────────────────────────────────────────────────

const AURA_PRICES: Record<string, number> = {
  flame: 0, water: 0,
  ice: 500, wind: 500,
  earth: 750, thunder: 750, cosmic: 750,
  light: 1000, shadow: 1000, crystal: 1000, nature: 1000, solar: 1000,
};

const AURA_TYPES = Object.keys(AURA_PRICES);

export async function getOwnedAuras(profileId: string): Promise<string[]> {
  parseProfileId(profileId);
  const result = await pool.query<{ aura_type: string }>(
    `select aura_type from user_auras where profile_id = $1`,
    [profileId],
  );
  return result.rows.map((r) => r.aura_type);
}

export async function ensureDefaultAuras(profileId: string): Promise<void> {
  parseProfileId(profileId);
  await pool.query(
    `insert into user_auras (profile_id, aura_type) values ($1, 'flame'), ($1, 'water') on conflict do nothing`,
    [profileId],
  );
  await pool.query(
    `update profiles set equipped_energy_id = 'flame' where id = $1 and equipped_energy_id is null`,
    [profileId],
  );
}

export async function getEquippedEnergyId(profileId: string): Promise<string | null> {
  parseProfileId(profileId);
  const result = await pool.query<{ equipped_energy_id: string | null }>(
    `select equipped_energy_id from profiles where id = $1`,
    [profileId],
  );
  return result.rows[0]?.equipped_energy_id ?? null;
}

export async function equipAura(
  profileId: string,
  auraType: string | null,
): Promise<void> {
  parseProfileId(profileId);
  if (auraType) {
    if (!AURA_TYPES.includes(auraType)) {
      throw new NotFoundError("Energia não encontrada.");
    }
    const owned = await pool.query(
      `select 1 from user_auras where profile_id = $1 and aura_type = $2`,
      [profileId, auraType],
    );
    if (!owned.rows[0]) throw new ForbiddenError("Você não possui esta energia.");
  }
  const result = await pool.query(
    `update profiles set equipped_energy_id = $2 where id = $1`,
    [profileId, auraType],
  );
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Perfil não encontrado.");
}

export async function purchaseAura(
  profileId: string,
  auraType: string,
): Promise<{ balance: number }> {
  parseProfileId(profileId);
  if (!AURA_TYPES.includes(auraType)) {
    throw new NotFoundError("Energia não encontrada.");
  }
  const price = AURA_PRICES[auraType];
  if (price <= 0) throw new ConflictError("Esta energia já está disponível.");

  const already = await pool.query(
    `select 1 from user_auras where profile_id = $1 and aura_type = $2`,
    [profileId, auraType],
  );
  if (already.rows[0]) throw new ConflictError("Você já possui esta energia.");

  const balance = await getCoinBalance(profileId);
  if (balance < price) throw new ForbiddenError("Moedas insuficientes.");

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `update user_settings set coins = coins - $1 where profile_id = $2`,
      [price, profileId],
    );
    await client.query(
      `insert into user_auras (profile_id, aura_type) values ($1, $2) on conflict do nothing`,
      [profileId, auraType],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return { balance: balance - price };
}

// ── Monthly Recaps ─────────────────────────────────────────────────────────

export async function getRecaps(profileId: string): Promise<MonthlyRecap[]> {
  parseProfileId(profileId);
  const result = await pool.query<{
    id: number; recap_month: Date | string; total_focus_minutes: number;
    longest_streak: number; league_tier: string | null; league_promoted: boolean | null;
    productivity_tag: string | null; generated_at: Date | string;
  }>(
    `select id, recap_month, total_focus_minutes, longest_streak, league_tier,
            league_promoted, productivity_tag, generated_at
     from monthly_recaps where profile_id = $1 order by recap_month desc`,
    [profileId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    profileId,
    recapMonth: typeof row.recap_month === "string" ? row.recap_month : row.recap_month.toISOString().slice(0, 10),
    totalFocusMinutes: row.total_focus_minutes,
    longestStreak: row.longest_streak,
    leagueTier: row.league_tier ?? undefined,
    leaguePromoted: row.league_promoted ?? undefined,
    productivityTag: row.productivity_tag ?? undefined,
    generatedAt: new Date(row.generated_at).toISOString(),
  }));
}

export async function generateRecap(
  profileId: string,
  monthDate: string,
): Promise<MonthlyRecap> {
  parseProfileId(profileId);
  const monthStart = monthDate.slice(0, 7) + "-01";
  const nextMonth = new Date(`${monthStart}T12:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const monthEnd = nextMonth.toISOString().slice(0, 10);

  const [focusRow, streakRow, leagueRow] = await Promise.all([
    pool.query<{ minutes: string | number }>(
      `select coalesce(sum(duration_minutes), 0) as minutes
       from focus_sessions
       where profile_id = $1 and ended_at is not null
         and started_at >= $2::date and started_at < $3::date`,
      [profileId, monthStart, monthEnd],
    ),
    pool.query<{ max_streak: string | number }>(
      `select coalesce(max(streak_value_at_use), 0) as max_streak
       from streak_shield_usage
       where profile_id = $1
         and used_on_date >= $2::date and used_on_date < $3::date`,
      [profileId, monthStart, monthEnd],
    ),
    pool.query<{ tier: string | null; result: string | null }>(
      `select le.tier, ls.last_week_result as result
       from league_entries le
       left join league_standings ls on ls.profile_id = le.profile_id
       where le.profile_id = $1
         and le.week_start >= $2::date and le.week_start < $3::date
       order by le.xp desc limit 1`,
      [profileId, monthStart, monthEnd],
    ),
  ]);

  const totalMinutes = Number(focusRow.rows[0]?.minutes ?? 0);
  const longestStreak = Number(streakRow.rows[0]?.max_streak ?? 0);
  const tier = leagueRow.rows[0]?.tier ?? undefined;
  const promoted = leagueRow.rows[0]?.result === "promoted";

  let tag = "Explorador";
  if (totalMinutes > 1000) tag = "Mestre do Foco";
  else if (totalMinutes > 500) tag = "Guerreiro da Energia";
  else if (totalMinutes > 200) tag = "Aprendiz Dedicado";

  const result = await pool.query<{
    id: number; recap_month: Date | string; total_focus_minutes: number;
    longest_streak: number; league_tier: string | null; league_promoted: boolean | null;
    productivity_tag: string | null; generated_at: Date | string;
  }>(
    `insert into monthly_recaps
       (profile_id, recap_month, total_focus_minutes, longest_streak, league_tier, league_promoted, productivity_tag)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (profile_id, recap_month) do update set
       total_focus_minutes = excluded.total_focus_minutes,
       longest_streak = excluded.longest_streak,
       league_tier = excluded.league_tier,
       league_promoted = excluded.league_promoted,
       productivity_tag = excluded.productivity_tag,
       generated_at = now()
     returning id, recap_month, total_focus_minutes, longest_streak, league_tier, league_promoted, productivity_tag, generated_at`,
    [profileId, monthStart, totalMinutes, longestStreak, tier ?? null, promoted, tag],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    profileId,
    recapMonth: typeof row.recap_month === "string" ? row.recap_month : row.recap_month.toISOString().slice(0, 10),
    totalFocusMinutes: row.total_focus_minutes,
    longestStreak: row.longest_streak,
    leagueTier: row.league_tier ?? undefined,
    leaguePromoted: row.league_promoted ?? undefined,
    productivityTag: row.productivity_tag ?? undefined,
    generatedAt: new Date(row.generated_at).toISOString(),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

export async function getCoinBalance(profileId: string): Promise<number> {
  parseProfileId(profileId);
  const result = await pool.query<{ coins: number }>(
    `select coins from user_settings where profile_id = $1`,
    [profileId],
  );
  return result.rows[0]?.coins ?? 0;
}
