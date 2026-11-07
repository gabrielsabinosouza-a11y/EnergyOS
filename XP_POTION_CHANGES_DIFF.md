# XP Potion Purchase Fix - Detailed Diffs

## 1. Route Handler Error Logging

**File:** `src/app/api/store/xp-boost/route.ts`

```diff
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
+   const errorMessage = error instanceof Error ? error.message : String(error);
+   const errorStack = error instanceof Error ? error.stack : undefined;
+   console.error("[xp-boost POST] Unexpected error:", { message: errorMessage, stack: errorStack });
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
```

**Explanation:** Logs the actual error details when an unexpected error occurs, making it possible to diagnose database errors.

---

## 2. Improved Cap Check Logic

**File:** `src/lib/db/xp-boost.ts`

### Before:
```typescript
const currentQuantity = inventory.rows[0]?.quantity ?? 0;
if (currentQuantity + quantity > XP_BOOST_MAX_HELD) {
  throw new BadRequestError(`Seu inventário está cheio (${XP_BOOST_MAX_HELD}/${XP_BOOST_MAX_HELD}).`);
}

const totalPrice = XP_BOOST_COST * quantity;
if (settings.rows[0].coins < totalPrice) {
  throw new BadRequestError(`Moedas insuficientes. São necessárias ${totalPrice} moedas.`);
}
```

### After:
```typescript
const currentQuantity = inventory.rows[0]?.quantity ?? 0;

// Check cap: reject if adding quantity would exceed max
if (currentQuantity >= XP_BOOST_MAX_HELD) {
  throw new ConflictError("Você já possui o máximo de poções.");
}
if (currentQuantity + quantity > XP_BOOST_MAX_HELD) {
  throw new ConflictError(`Seu inventário está cheio (${XP_BOOST_MAX_HELD}/${XP_BOOST_MAX_HELD}).`);
}

const totalPrice = XP_BOOST_COST * quantity;
if (settings.rows[0].coins < totalPrice) {
  throw new BadRequestError("Moedas insuficientes.");
}
```

**Explanation:**
- Separate check for "already at max" (409 Conflict)
- Separate check for "would exceed max" (409 Conflict)
- Simplified insufficient coins message (400 Bad Request)
- Uses `ConflictError` (409) for cap violations instead of `BadRequestError` (400)

---

## 3. Frontend Error Handling

**File:** `src/components/dashboard/xp-badge.tsx`

```diff
  async function handleBuy() {
    if (buyLockRef.current || buyDisabled) return;
    buyLockRef.current = true;
    setProcessing("buy");
    setError(null);
    try {
      const { balance, quantity } = await api.purchaseXpBoost();
      onCoinsChange(balance);
      setPotionQuantity(quantity);
    } catch (e) {
-     setError(e instanceof Error ? e.message : "Erro ao comprar a poção.");
+     const errorMessage = e instanceof Error ? e.message : "Erro ao comprar a poção.";
+     setError(errorMessage);
    } finally {
      buyLockRef.current = false;
      setProcessing(null);
    }
  }
```

**Explanation:** Ensures error messages are properly extracted and displayed. (Minor improvement for clarity.)

---

## 4. Database-Level Constraint

**File:** `migrations/2026-11-07-xp-potion-cap-constraint.sql`

```sql
-- Migration: Add CHECK constraint to enforce XP potion cap at database level
-- Ensures quantity never exceeds XP_BOOST_MAX_HELD (2) even if application logic fails

alter table user_potions add constraint user_potions_quantity_check 
  check (quantity >= 0 and quantity <= 2) not valid;

-- Validate the constraint (will fail if any existing rows violate it)
alter table user_potions validate constraint user_potions_quantity_check;
```

**Explanation:**
- Adds a CHECK constraint at the database level
- Prevents invalid states even if application logic fails
- Returns error code 23514 if violated
- Uses `not valid` to avoid locking the table during migration

---

## 5. Updated Tests

**File:** `src/lib/db/xp-boost.test.ts`

### Before:
```typescript
await assert.rejects(
  purchaseXpBoost(PROFILE_ID, 1, "f64f9772-7df8-4a10-8624-c82ee238f9bd"),
  (error: unknown) => error instanceof AppError
    && error.status === 400
    && error.message.includes("inventário está cheio"),
);
```

### After:
```typescript
await assert.rejects(
  purchaseXpBoost(PROFILE_ID, 1, "f64f9772-7df8-4a10-8624-c82ee238f9bd"),
  (error: unknown) => error instanceof AppError
    && error.status === 409
    && error.message.includes("máximo de poções"),
);
```

**Explanation:** Updated test to expect 409 status and new error message for cap reached.

---

## Summary of Changes

| File | Change | Impact |
|------|--------|--------|
| `route.ts` | Add error logging | Can now diagnose database errors |
| `xp-boost.ts` | Improve cap check | Clear error messages, correct HTTP status |
| `xp-badge.tsx` | Improve error handling | Ensures errors are displayed |
| `xp-boost.test.ts` | Update tests | Tests match new behavior |
| `migration` | Add CHECK constraint | Database-level enforcement |

---

## Error Codes

### Before:
- Cap reached: 400 "Seu inventário está cheio (2/2)."
- Insufficient coins: 400 "Moedas insuficientes. São necessárias 250 moedas."

### After:
- Already at max: 409 "Você já possui o máximo de poções."
- Would exceed max: 409 "Seu inventário está cheio (2/2)."
- Insufficient coins: 400 "Moedas insuficientes."

---

## Testing

### Unit Tests
```bash
npm test -- src/lib/db/xp-boost.test.ts
```

### Manual Test
```bash
npx ts-node scripts/test-potion-purchase.ts
```

### Integration Test (Manual)
1. Open dashboard
2. Click XP badge
3. Buy 1 potion (should succeed)
4. Buy 2nd potion (should succeed)
5. Try to buy 3rd potion (should show "Você já possui o máximo de poções." with no spinner)
6. Try buying with < 250 coins (should show "Moedas insuficientes." with no spinner)
