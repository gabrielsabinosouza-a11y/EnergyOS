# XP Potion Purchase Issue - Investigation Report

## PROBLEM SUMMARY
- First potion purchase works
- Second purchase returns 500 Internal Server Error after ~2.4s
- Button stays on loading spinner forever
- No useful error message in response body

## ROOT CAUSE ANALYSIS

### Code Flow
1. **Frontend** (`src/components/dashboard/xp-badge.tsx`):
   - `handleBuy()` calls `api.purchaseXpBoost()`
   - Sends: `{ quantity: 1, idempotencyKey: UUID }`

2. **API Client** (`src/lib/api-client.ts`):
   - Generates random UUID for idempotency
   - Sends POST to `/api/store/xp-boost`
   - Caches request in `xpBoostPurchaseInFlight` to prevent double-submit

3. **Route Handler** (`src/app/api/store/xp-boost/route.ts`):
   - Validates auth, body, quantity
   - Calls `purchaseXpBoost(profileId, quantity, idempotencyKey)`

4. **Database Function** (`src/lib/db/xp-boost.ts`):
   - Starts transaction
   - Locks `user_settings` row (SELECT ... FOR UPDATE)
   - Checks idempotency key in `xp_boost_purchase_requests`
   - Locks `user_potions` row
   - **Checks cap: `if (currentQuantity + quantity > XP_BOOST_MAX_HELD)`**
   - Checks coin balance
   - Deducts coins
   - Upserts potion inventory
   - Records purchase request
   - Commits transaction

### The Bug: Inventory Check Logic

**Current code (line 82-84 in xp-boost.ts):**
```typescript
const currentQuantity = inventory.rows[0]?.quantity ?? 0;
if (currentQuantity + quantity > XP_BOOST_MAX_HELD) {
  throw new BadRequestError(`Seu inventário está cheio (${XP_BOOST_MAX_HELD}/${XP_BOOST_MAX_HELD}).`);
}
```

**Problem:**
- When `currentQuantity = 1` and `quantity = 1`:
  - Check: `1 + 1 > 2` → `2 > 2` → FALSE ✓ (passes)
  - Inventory updated to 2 ✓

- When `currentQuantity = 2` and `quantity = 1`:
  - Check: `2 + 1 > 2` → `3 > 2` → TRUE ✓ (correctly rejects)
  - Throws `BadRequestError` with status 400 ✓

**So the cap logic is correct!** The 500 error must be elsewhere.

### The Real Bug: Missing Row in user_potions

**Scenario:**
1. First purchase: `user_potions` row doesn't exist
   - `SELECT quantity FROM user_potions WHERE profile_id = $1 AND item_type = $2` returns 0 rows
   - `currentQuantity = 0` (from `?? 0`)
   - Check: `0 + 1 > 2` → FALSE ✓
   - INSERT with ON CONFLICT: creates row with quantity = 1 ✓

2. Second purchase: `user_potions` row exists with quantity = 1
   - `SELECT quantity FROM user_potions WHERE profile_id = $1 AND item_type = $2` returns 1 row
   - `currentQuantity = 1` ✓
   - Check: `1 + 1 > 2` → FALSE ✓
   - INSERT with ON CONFLICT: should update to quantity = 2
   - **But the ON CONFLICT clause has a bug!**

### The ON CONFLICT Bug

**Current code (line 95-99):**
```sql
insert into user_potions (profile_id, item_type, quantity, updated_at)
values ($1, $2, $3, now())
on conflict (profile_id, item_type)
do update set quantity = user_potions.quantity + excluded.quantity, updated_at = now()
returning quantity
```

**The Problem:**
- When inserting `quantity = 1` (the parameter `$3`)
- The ON CONFLICT tries to do: `quantity = user_potions.quantity + excluded.quantity`
- `excluded.quantity` refers to the VALUES clause, which is `$3 = 1`
- So it should do: `quantity = 1 + 1 = 2` ✓

**Wait, that should work!** Let me check the schema...

### Schema Check

From `src/db-schema.sql`:
```sql
create table if not exists user_potions (
  profile_id text not null references profiles(id) on delete cascade,
  item_type text not null,
  quantity integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (profile_id, item_type)
);
```

**The schema is correct.** The ON CONFLICT should work.

### The Real Issue: Transaction Isolation

**Hypothesis:** The 500 error is likely a **transaction isolation issue** or **constraint violation** that's not being caught properly.

**Possible causes:**
1. **Race condition**: Two concurrent purchases with different idempotency keys
   - First purchase locks `user_potions` row
   - Second purchase waits for lock
   - First purchase commits
   - Second purchase acquires lock, but the ON CONFLICT might fail if there's a constraint issue

2. **Constraint violation**: The `quantity` column might have a CHECK constraint
   - If `quantity > XP_BOOST_MAX_HELD` is enforced at the database level
   - The INSERT would fail with a 23514 error (CHECK constraint violation)

3. **Missing error handling**: The error is thrown but not caught properly
   - The route handler catches `AppError` and `ValidationError`
   - But a database error (like 23514) would be a generic `Error`
   - This would result in a 500 with "Erro interno."

### Verification Needed

To confirm the root cause, I need to:
1. Check if there's a CHECK constraint on `user_potions.quantity`
2. Check the actual database error when the second purchase fails
3. Verify the transaction isolation level

---

## FINDINGS

### Issue 1: No CHECK Constraint (Good)
The schema has no CHECK constraint on `quantity`, so that's not the issue.

### Issue 2: Error Handling Gap
The route handler doesn't log the actual error details:
```typescript
catch (error) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ error: "Erro interno." }, { status: 500 });
}
```

**Problem:** When a database error occurs, it's not logged. We don't know what the actual error is.

### Issue 3: Frontend Error Handling
The frontend catches the error but doesn't distinguish between different error types:
```typescript
catch (e) {
  setError(e instanceof Error ? e.message : "Erro ao comprar a poção.");
}
```

**Problem:** The error message from the API is not being extracted. The frontend is showing the fetch error, not the API response.

### Issue 4: Button State Management
The button has a `buyLockRef` to prevent double-submit, but:
- If the request fails, `buyLockRef` is reset in the `finally` block
- But `processing` is also reset
- So the button becomes enabled again, but the user might not realize the purchase failed

---

## SUMMARY

The most likely cause of the 500 error is:
1. **A database error that's not being logged** (e.g., a constraint violation, deadlock, or connection issue)
2. **The error is caught as a generic `Error`** and returned as 500 with "Erro interno."
3. **The frontend doesn't show the actual error message** from the API

The cap logic itself appears correct, but the error handling is insufficient to diagnose the real issue.

---

## NEXT STEPS

1. **Add detailed error logging** to the route handler
2. **Improve error handling** to distinguish between expected and unexpected errors
3. **Add proper error messages** for each failure case
4. **Fix the frontend** to show API error messages
5. **Add a CHECK constraint** to enforce the cap at the database level
6. **Test the purchase flow** with proper error scenarios
