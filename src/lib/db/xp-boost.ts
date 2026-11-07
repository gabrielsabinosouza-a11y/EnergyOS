import pool from "../db";
import {
  XP_BOOST_ITEM_TYPE,
  XP_BOOST_COST,
  XP_BOOST_MAX_HELD,
  XP_BOOST_DURATION_MS,
  XP_BOOST_MULTIPLIER,
  applyXPBoost,
} from "@/lib/xp-boost";
import { BadRequestError, ConflictError, NotFoundError } from "../errors";
import { parseProfileId } from "./validation";

export interface UserPotionInventory {
  userId: string;
  itemType: string;
  quantity: number;
}

export interface ActiveXPBoost {
  userId: string;
  activatedAt: string;
  expiresAt: string;
  multiplier: number;
  isActive: boolean;
}

async function getPotionQuantity(profileId: string, itemType: string): Promise<number> {
  const result = await pool.query<{ quantity: number }>(
    `select quantity from user_potions where profile_id = $1 and item_type = $2`,
    [profileId, itemType],
  );
  return result.rows[0]?.quantity ?? 0;
}

/** Current unused potion inventory for the user (capped by XP_BOOST_MAX_HELD). */
export async function getUserPotionInventory(profileId: string): Promise<UserPotionInventory | null> {
  parseProfileId(profileId);
  const quantity = await getPotionQuantity(profileId, XP_BOOST_ITEM_TYPE);
  if (quantity <= 0) return null;
  return { userId: profileId, itemType: XP_BOOST_ITEM_TYPE, quantity };
}

export async function purchaseXpBoost(
  profileId: string,
  quantity: number,
  idempotencyKey: string,
): Promise<{ balance: number; quantity: number }> {
  parseProfileId(profileId);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > XP_BOOST_MAX_HELD) {
    throw new BadRequestError("Quantidade de poções inválida.");
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idempotencyKey)
  ) {
    throw new BadRequestError("Chave de compra inválida.");
  }

  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query("begin");
    transactionStarted = true;

    const settings = await client.query<{ coins: number }>(
      `select coins from user_settings where profile_id = $1 for update`,
      [profileId],
    );
    if (!settings.rows[0]) throw new NotFoundError("Configurações do usuário não encontradas.");

    const previousPurchase = await client.query<{
      requested_quantity: number;
      balance: number;
      potion_quantity: number;
    }>(
      `select requested_quantity, balance, potion_quantity
       from xp_boost_purchase_requests
       where profile_id = $1 and idempotency_key = $2`,
      [profileId, idempotencyKey],
    );
    const previous = previousPurchase.rows[0];
    if (previous) {
      if (previous.requested_quantity !== quantity) {
        throw new BadRequestError("Chave de compra já utilizada para outra quantidade.");
      }
      await client.query("commit");
      transactionStarted = false;
      return { balance: previous.balance, quantity: previous.potion_quantity };
    }

    const inventory = await client.query<{ quantity: number }>(
      `select quantity from user_potions
       where profile_id = $1 and item_type = $2
       for update`,
      [profileId, XP_BOOST_ITEM_TYPE],
    );
    const currentQuantity = inventory.rows[0]?.quantity ?? 0;

    // Reject when the requested purchase would exceed the cap. Both branches
    // use the exact message/status the UI and tests rely on.
    if (currentQuantity >= XP_BOOST_MAX_HELD || currentQuantity + quantity > XP_BOOST_MAX_HELD) {
      console.log("[xp-boost] Cap check failed:", { currentQuantity, quantity, XP_BOOST_MAX_HELD });
      throw new ConflictError("Você já possui o máximo de poções.");
    }

    const totalPrice = XP_BOOST_COST * quantity;
    if (settings.rows[0].coins < totalPrice) {
      throw new BadRequestError("Moedas insuficientes.");
    }

    // Guarded deduction: even though settings are locked above, the WHERE
    // clause makes the balance check atomic with the write.
    const deduct = await client.query<{ coins: number }>(
      `update user_settings set coins = coins - $1 where profile_id = $2 and coins >= $1 returning coins`,
      [totalPrice, profileId],
    );
    const balance = deduct.rows[0]?.coins;
    if (balance === undefined) throw new BadRequestError("Moedas insuficientes.");

    const targetQuantity = currentQuantity + quantity;
    console.log("[xp-boost] Upserting potion inventory:", { profileId, currentQuantity, quantity, targetQuantity });
    const upserted = await client.query<{ quantity: number }>(
      `insert into user_potions (profile_id, item_type, quantity, updated_at)
       values ($1, $2, $3, now())
       on conflict (profile_id, item_type)
       do update set quantity = $3, updated_at = now()
       returning quantity`,
      [profileId, XP_BOOST_ITEM_TYPE, targetQuantity],
    );
    console.log("[xp-boost] Upsert result:", { rows: upserted.rows.length, quantity: upserted.rows[0]?.quantity });
    if (!upserted.rows[0]) throw new ConflictError("Não foi possível atualizar o inventário de poções.");

    await client.query(
      `insert into xp_boost_purchase_requests
       (profile_id, idempotency_key, requested_quantity, balance, potion_quantity)
       values ($1, $2, $3, $4, $5)`,
      [profileId, idempotencyKey, quantity, balance, upserted.rows[0].quantity],
    );
    await client.query("commit");
    transactionStarted = false;

    return { balance, quantity: upserted.rows[0].quantity };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("rollback");
      } catch (rollbackError) {
        console.error("[xp-boost] Failed to rollback purchase transaction:", rollbackError);
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function getActiveBoost(profileId: string): Promise<ActiveXPBoost | null> {
  parseProfileId(profileId);
  const result = await pool.query<{
    multiplier: number;
    activated_at: Date | string;
    expires_at: Date | string;
  }>(
    `select multiplier, activated_at, expires_at from active_xp_boost
     where profile_id = $1 and expires_at > now()`,
    [profileId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    userId: profileId,
    multiplier: row.multiplier,
    activatedAt: typeof row.activated_at === "string" ? row.activated_at : row.activated_at.toISOString(),
    expiresAt: typeof row.expires_at === "string" ? row.expires_at : row.expires_at.toISOString(),
    isActive: true,
  };
}

/**
 * Activate one potion. Decrements inventory by 1 and starts a single
 * XP_BOOST_DURATION_MS boost. If a non-expired boost is already running,
 * this is a no-op on inventory (transaction rolls back) and throws.
 *
 * `extended` is always false; kept on the return type for API compatibility.
 */
export async function activateXpBoost(profileId: string): Promise<{
  boost: ActiveXPBoost;
  extended: boolean;
  quantity: number;
}> {
  parseProfileId(profileId);

  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query("begin");
    transactionStarted = true;

    // Serialize activations per user so a double-submit cannot consume two potions.
    const potionRes = await client.query<{ quantity: number }>(
      `select quantity from user_potions
       where profile_id = $1 and item_type = $2
       for update`,
      [profileId, XP_BOOST_ITEM_TYPE],
    );
    const quantity = potionRes.rows[0]?.quantity ?? 0;
    if (quantity <= 0) {
      throw new ConflictError("Você não possui poções de XP para usar");
    }

    const existing = await client.query<{ expires_at: Date | string }>(
      `select expires_at from active_xp_boost where profile_id = $1 for update`,
      [profileId],
    );
    const existingExpiry = existing.rows[0]?.expires_at
      ? new Date(
          typeof existing.rows[0].expires_at === "string"
            ? existing.rows[0].expires_at
            : existing.rows[0].expires_at,
        )
      : null;
    if (existingExpiry && existingExpiry.getTime() > Date.now()) {
      throw new ConflictError("Poção já ativa");
    }

    await client.query(
      `update user_potions set quantity = quantity - 1, updated_at = now()
       where profile_id = $1 and item_type = $2 and quantity > 0`,
      [profileId, XP_BOOST_ITEM_TYPE],
    );

    const newExpires = new Date(Date.now() + XP_BOOST_DURATION_MS);
    await client.query(
      `insert into active_xp_boost (profile_id, multiplier, activated_at, expires_at)
       values ($1, $2, now(), $3)
       on conflict (profile_id) do update set
         multiplier = excluded.multiplier,
         activated_at = now(),
         expires_at = excluded.expires_at`,
      [profileId, XP_BOOST_MULTIPLIER, newExpires],
    );

    await client.query("commit");
    transactionStarted = false;

    return {
      boost: {
        userId: profileId,
        multiplier: XP_BOOST_MULTIPLIER,
        activatedAt: new Date().toISOString(),
        expiresAt: newExpires.toISOString(),
        isActive: true,
      },
      extended: false,
      quantity: quantity - 1,
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("rollback");
      } catch (rollbackError) {
        console.error("[xp-boost] Failed to rollback activate transaction:", rollbackError);
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Shared boost-aware XP calculation. Returns `baseXP * multiplier` when the
 * user has an active (non-expired) boost, otherwise `baseXP` unchanged.
 * Every XP-granting code path should route through this.
 */
export async function calculateXPWithBoost(profileId: string, baseXP: number): Promise<number> {
  parseProfileId(profileId);
  if (!Number.isFinite(baseXP) || baseXP <= 0) return Math.max(0, Math.round(baseXP || 0));

  const result = await pool.query<{ multiplier: number }>(
    `select multiplier from active_xp_boost where profile_id = $1 and expires_at > now()`,
    [profileId],
  );
  const multiplier = result.rows[0]?.multiplier ?? null;
  return applyXPBoost(baseXP, multiplier);
}

export { XP_BOOST_ITEM_TYPE, XP_BOOST_COST, XP_BOOST_MAX_HELD, XP_BOOST_DURATION_MS, XP_BOOST_MULTIPLIER };
