import pool from "../db";
import type { AvatarDecoration, DecorationRarity, StoreItem, UserDecoration, StreakShieldDesign, UserStreakShieldDesign } from "@/types";
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
  const price = decoration.rows[0].price;

  const client = await pool.connect();
  try {
    await client.query("begin");

    // Authoritative, race-safe balance check: the guarded deduction only
    // succeeds when the balance covers the price, atomically.
    const deduct = await client.query<{ coins: number }>(
      `update user_settings set coins = coins - $1 where profile_id = $2 and coins >= $1 returning coins`,
      [price, profileId],
    );
    if (!deduct.rows[0]) throw new ForbiddenError("Moedas insuficientes.");

    // Ownership is enforced inside the same transaction; a concurrent double
    // purchase can no longer charge twice for one item.
    const inserted = await client.query<{ decoration_id: string }>(
      `insert into user_decorations (profile_id, decoration_id) values ($1, $2)
       on conflict (profile_id, decoration_id) do nothing returning decoration_id`,
      [profileId, decorationId],
    );
    if (!inserted.rows[0]) throw new ConflictError("Você já possui esta decoração.");

    await client.query("commit");
    return { balance: deduct.rows[0].coins };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
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

  const client = await pool.connect();
  try {
    await client.query("begin");

    const deduct = await client.query<{ coins: number }>(
      `update user_settings set coins = coins - $1 where profile_id = $2 and coins >= $1 returning coins`,
      [BANNER_COST, profileId],
    );
    if (!deduct.rows[0]) throw new ForbiddenError("Moedas insuficientes.");

    const updated = await client.query<{ id: string | number }>(
      `update profiles set has_custom_banner = true
       where id = $1 and has_custom_banner = false
       returning id`,
      [profileId],
    );
    if (!updated.rows[0]) throw new ConflictError("Banner já desbloqueado.");

    await client.query("commit");
    return { balance: deduct.rows[0].coins };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
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

  const client = await pool.connect();
  try {
    await client.query("begin");

    // Deduct first (guarded), then increment the shield count atomically with
    // a cap check in the same statement. Any failure rolls everything back.
    const deduct = await client.query<{ coins: number }>(
      `update user_settings set coins = coins - $1 where profile_id = $2 and coins >= $1 returning coins`,
      [SHIELD_COST, profileId],
    );
    if (!deduct.rows[0]) throw new ForbiddenError("Moedas insuficientes.");

    const updated = await client.query<{ streak_shield_count: number }>(
      `update profiles set streak_shield_count = streak_shield_count + 1
       where id = $1 and streak_shield_count < $2
       returning streak_shield_count`,
      [profileId, MAX_SHIELDS],
    );
    if (!updated.rows[0]) throw new ConflictError(`Você já possui o máximo de ${MAX_SHIELDS} escudos.`);

    await client.query("commit");
    return { balance: deduct.rows[0].coins, shieldCount: updated.rows[0].streak_shield_count };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
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
  ice: 500, wind: 500, metal: 500, poison: 500,
  earth: 750, thunder: 750, cosmic: 750,
  light: 1000, shadow: 1000, crystal: 1000,
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
}

export interface StoreState {
  items: StoreItem[];
  balance: number;
  banner: { hasCustomBanner: boolean; bannerImageUrl: string | null; unlocked: boolean };
  shieldCount: number;
  ownedAuras: string[];
}

/**
 * Carrega todo o estado da loja com o menor número possível de consultas.
 * Combina as várias leituras da tabela `profiles` em uma única query (antes eram
 * 5+), reduzindo bastante a latência — especialmente em Neon/serverless onde cada
 * round-trip custa dezenas de ms.
 */
export async function getStoreState(profileId: string): Promise<StoreState> {
  parseProfileId(profileId);

  const [profiles, decs, ownedDecs, coins, auras] = await Promise.all([
    pool.query<{
      equipped_decoration_id: string | null;
      has_custom_banner: boolean;
      banner_image_url: string | null;
      streak_shield_count: number;
    }>(
      `select equipped_decoration_id, has_custom_banner, banner_image_url, streak_shield_count
       from profiles where id = $1`,
      [profileId],
    ),
    pool.query<{
      id: string; name: string; description: string; image_url: string;
      price: number; rarity: DecorationRarity; sort_order: number;
    }>(
      `select id, name, description, image_url, price, rarity, sort_order
       from avatar_decorations where is_active = true order by sort_order asc`,
    ),
    pool.query<{ decoration_id: string }>(
      `select decoration_id from user_decorations where profile_id = $1`,
      [profileId],
    ),
    pool.query<{ coins: number }>(
      `select coins from user_settings where profile_id = $1`,
      [profileId],
    ),
    pool.query<{ aura_type: string }>(
      `select aura_type from user_auras where profile_id = $1`,
      [profileId],
    ),
  ]);

  const profile = profiles.rows[0];
  const ownedIds = new Set(ownedDecs.rows.map((row) => row.decoration_id));
  const equippedDecorationId = profile?.equipped_decoration_id ?? null;

  const items: StoreItem[] = decs.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    price: row.price,
    rarity: row.rarity,
    sortOrder: row.sort_order,
    owned: ownedIds.has(row.id),
    equipped: equippedDecorationId === row.id,
  }));

  return {
    items,
    balance: Number(coins.rows[0]?.coins ?? 0),
    banner: {
      hasCustomBanner: profile?.has_custom_banner ?? false,
      bannerImageUrl: profile?.banner_image_url ?? null,
      unlocked: profile?.has_custom_banner ?? false,
    },
    shieldCount: Number(profile?.streak_shield_count ?? 0),
    ownedAuras: auras.rows.map((row) => row.aura_type),
  };
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

  const client = await pool.connect();
  try {
    await client.query("begin");

    const deduct = await client.query<{ coins: number }>(
      `update user_settings set coins = coins - $1 where profile_id = $2 and coins >= $1 returning coins`,
      [price, profileId],
    );
    if (!deduct.rows[0]) throw new ForbiddenError("Moedas insuficientes.");

    const inserted = await client.query<{ aura_type: string }>(
      `insert into user_auras (profile_id, aura_type) values ($1, $2)
       on conflict (profile_id, aura_type) do nothing returning aura_type`,
      [profileId, auraType],
    );
    if (!inserted.rows[0]) throw new ConflictError("Você já possui esta energia.");

    await client.query("commit");
    return { balance: deduct.rows[0].coins };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
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

// ── Streak Shield Designs ─────────────────────────────────────────────────────

interface StreakShieldDesignRow {
  id: string;
  name: string;
  description: string;
  image_url: string;
  icon_url: string;
  price: number;
  rarity: string;
  sort_order: number;
  is_active: boolean;
  created_at: Date | string;
}

function mapStreakShieldDesign(row: StreakShieldDesignRow): StreakShieldDesign {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    iconUrl: row.icon_url,
    price: row.price,
    rarity: row.rarity as DecorationRarity,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

interface UserStreakShieldDesignRow {
  profile_id: string;
  shield_design_id: string;
  purchased_at: Date | string;
}

function mapUserStreakShieldDesign(row: UserStreakShieldDesignRow): UserStreakShieldDesign {
  return {
    profileId: row.profile_id,
    shieldDesignId: row.shield_design_id,
    purchasedAt: new Date(row.purchased_at).toISOString(),
  };
}

export async function getAllStreakShieldDesigns(): Promise<StreakShieldDesign[]> {
  const result = await pool.query<StreakShieldDesignRow>(
    `select id, name, description, image_url, icon_url, price, rarity, sort_order, is_active, created_at
     from streak_shield_designs
     where is_active = true
     order by sort_order`,
  );
  return result.rows.map(mapStreakShieldDesign);
}

export async function getOwnedStreakShieldDesigns(profileId: string): Promise<string[]> {
  parseProfileId(profileId);
  const result = await pool.query<{ shield_design_id: string }>(
    `select shield_design_id
     from user_streak_shield_designs
     where profile_id = $1`,
    [profileId],
  );
  return result.rows.map((row) => row.shield_design_id);
}

export async function getEquippedShieldDesignId(profileId: string): Promise<string | null> {
  parseProfileId(profileId);
  const result = await pool.query<{ equipped_shield_design_id: string | null }>(
    `select equipped_shield_design_id
     from profiles
     where id = $1`,
    [profileId],
  );
  return result.rows[0]?.equipped_shield_design_id ?? null;
}

export async function purchaseStreakShieldDesign(
  profileId: string,
  shieldDesignId: string,
): Promise<{ balance: number; ownedDesigns: string[] }> {
  parseProfileId(profileId);

  // Get shield design info
  const designResult = await pool.query<{ price: number; id: string }>(
    `select price, id from streak_shield_designs where id = $1 and is_active = true`,
    [shieldDesignId],
  );

  if (designResult.rowCount === 0) {
    throw new NotFoundError("Escudo não encontrado ou não está disponível.");
  }

  const design = designResult.rows[0];
  const price = design.price;

  const client = await pool.connect();
  try {
    await client.query("begin");

    // Guarded deduction — the balance is verified atomically inside the tx.
    const deduct = await client.query<{ coins: number }>(
      `update user_settings set coins = coins - $1 where profile_id = $2 and coins >= $1 returning coins`,
      [price, profileId],
    );
    if (!deduct.rows[0]) throw new ForbiddenError("Moedas insuficientes.");

    // Ownership check inside the transaction prevents a concurrent double
    // purchase from charging twice for the same design.
    const inserted = await client.query<{ shield_design_id: string }>(
      `insert into user_streak_shield_designs (profile_id, shield_design_id) values ($1, $2)
       on conflict (profile_id, shield_design_id) do nothing returning shield_design_id`,
      [profileId, shieldDesignId],
    );
    if (!inserted.rows[0]) throw new ConflictError("Você já possui este escudo.");

    // If this is the first shield design, equip it automatically
    const ownedCount = await client.query(
      `select count(*)::int as count from user_streak_shield_designs where profile_id = $1`,
      [profileId],
    );

    if (ownedCount.rows[0]?.count === 1) {
      await client.query(
        `update profiles set equipped_shield_design_id = $1 where id = $2`,
        [shieldDesignId, profileId],
      );
    }

    await client.query("commit");

    // Get updated owned designs
    const ownedDesigns = await getOwnedStreakShieldDesigns(profileId);

    return { balance: deduct.rows[0].coins, ownedDesigns };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function equipStreakShieldDesign(
  profileId: string,
  shieldDesignId: string,
): Promise<{ success: boolean }> {
  parseProfileId(profileId);

  // Check if user owns this design
  const ownedResult = await pool.query(
    `select 1 from user_streak_shield_designs where profile_id = $1 and shield_design_id = $2`,
    [profileId, shieldDesignId],
  );

  if (ownedResult.rowCount === 0) {
    throw new ForbiddenError("Você não possui este escudo.");
  }

  // Check if design exists
  const designResult = await pool.query<{ id: string }>(
    `select id from streak_shield_designs where id = $1 and is_active = true`,
    [shieldDesignId],
  );

  if (designResult.rowCount === 0) {
    throw new NotFoundError("Escudo não encontrado.");
  }

  await pool.query(
    `update profiles set equipped_shield_design_id = $1 where id = $2`,
    [shieldDesignId, profileId],
  );

  return { success: true };
}

export async function getStreakShieldDesignById(shieldDesignId: string): Promise<StreakShieldDesign | null> {
  const result = await pool.query<StreakShieldDesignRow>(
    `select id, name, description, image_url, icon_url, price, rarity, sort_order, is_active, created_at
     from streak_shield_designs
     where id = $1 and is_active = true`,
    [shieldDesignId],
  );

  return (result.rowCount ?? 0) > 0 ? mapStreakShieldDesign(result.rows[0]) : null;
}
