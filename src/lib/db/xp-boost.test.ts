import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import pool from "../db";
import { AppError } from "../errors";
import { purchaseXpBoost } from "./xp-boost";

const PROFILE_ID = "0e719da0-f486-469c-b27f-9b3b5612fb50";
const FIRST_KEY = "12c0c318-66e7-4f70-9364-756d0c461713";
const SECOND_KEY = "bfcf21b8-3ec4-4d05-a528-9707b1fab431";

interface PurchaseState {
  coins: number;
  potionQuantity: number;
  purchases: Map<string, { requested_quantity: number; balance: number; potion_quantity: number }>;
  transactionOpen: boolean;
}

let originalConnect: PropertyDescriptor | undefined;

afterEach(() => {
  if (originalConnect) {
    Object.defineProperty(pool, "connect", originalConnect);
  } else {
    Reflect.deleteProperty(pool, "connect");
  }
  originalConnect = undefined;
});

function usePurchaseState(state: PurchaseState) {
  const client = {
    async query(sql: string, params: unknown[] = []) {
      const statement = sql.replace(/\s+/g, " ").trim().toLowerCase();
      if (statement === "begin") {
        state.transactionOpen = true;
        return { rows: [] };
      }
      if (statement === "commit") {
        state.transactionOpen = false;
        return { rows: [] };
      }
      if (statement === "rollback") {
        state.transactionOpen = false;
        return { rows: [] };
      }
      if (statement.startsWith("select coins from user_settings")) {
        return { rows: [{ coins: state.coins }] };
      }
      if (statement.startsWith("select requested_quantity, balance, potion_quantity")) {
        const purchase = state.purchases.get(String(params[1]));
        return { rows: purchase ? [purchase] : [] };
      }
      if (statement.startsWith("select quantity from user_potions")) {
        return { rows: state.potionQuantity > 0 ? [{ quantity: state.potionQuantity }] : [] };
      }
      if (statement.startsWith("update user_settings set coins = coins -")) {
        state.coins -= Number(params[0]);
        return { rows: [{ coins: state.coins }] };
      }
      if (statement.startsWith("insert into user_potions")) {
        state.potionQuantity += Number(params[2]);
        return { rows: [{ quantity: state.potionQuantity }] };
      }
      if (statement.startsWith("insert into xp_boost_purchase_requests")) {
        state.purchases.set(String(params[1]), {
          requested_quantity: Number(params[2]),
          balance: Number(params[3]),
          potion_quantity: Number(params[4]),
        });
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL in purchase test: ${statement}`);
    },
    release() {},
  };

  originalConnect = Object.getOwnPropertyDescriptor(pool, "connect");
  Object.defineProperty(pool, "connect", {
    configurable: true,
    value: async () => client as unknown as PoolClient,
  });
}

function state(coins: number, potionQuantity = 0): PurchaseState {
  return { coins, potionQuantity, purchases: new Map(), transactionOpen: false };
}

describe("purchaseXpBoost", () => {
  it("compra uma poção por 250 moedas e devolve o saldo e inventário atualizados", async () => {
    const db = state(1000);
    usePurchaseState(db);

    const result = await purchaseXpBoost(PROFILE_ID, 1, FIRST_KEY);

    assert.deepEqual(result, { balance: 750, quantity: 1 });
    assert.equal(db.coins, 750);
    assert.equal(db.potionQuantity, 1);
  });

  it("permite a segunda poção por mais 250 moedas, mas rejeita a terceira sem alterar o saldo", async () => {
    const db = state(1000);
    usePurchaseState(db);

    assert.deepEqual(await purchaseXpBoost(PROFILE_ID, 1, FIRST_KEY), { balance: 750, quantity: 1 });
    assert.deepEqual(await purchaseXpBoost(PROFILE_ID, 1, SECOND_KEY), { balance: 500, quantity: 2 });
    await assert.rejects(
      purchaseXpBoost(PROFILE_ID, 1, "f64f9772-7df8-4a10-8624-c82ee238f9bd"),
      (error: unknown) => error instanceof AppError
        && error.status === 400
        && error.message.includes("inventário está cheio"),
    );

    assert.equal(db.coins, 500);
    assert.equal(db.potionQuantity, 2);
    assert.equal(db.transactionOpen, false);
  });

  it("rejeita saldo insuficiente sem debitar moedas nem conceder poção", async () => {
    const db = state(249);
    usePurchaseState(db);

    await assert.rejects(
      purchaseXpBoost(PROFILE_ID, 1, FIRST_KEY),
      (error: unknown) => error instanceof AppError
        && error.status === 400
        && error.message.includes("Moedas insuficientes"),
    );

    assert.equal(db.coins, 249);
    assert.equal(db.potionQuantity, 0);
    assert.equal(db.transactionOpen, false);
  });

  it("não cobra nem concede novamente quando a mesma compra é reenviada", async () => {
    const db = state(500);
    usePurchaseState(db);

    const first = await purchaseXpBoost(PROFILE_ID, 1, FIRST_KEY);
    const retry = await purchaseXpBoost(PROFILE_ID, 1, FIRST_KEY);

    assert.deepEqual(retry, first);
    assert.equal(db.coins, 250);
    assert.equal(db.potionQuantity, 1);
  });
});
