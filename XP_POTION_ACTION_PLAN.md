# XP Potion Purchase Fix - Action Plan

## Overview

This plan addresses the 500 Internal Server Error on the second XP potion purchase. The fixes include:
1. Better error logging to diagnose issues
2. Correct HTTP status codes for different error scenarios
3. Clear, actionable error messages
4. Database-level constraint to enforce the cap

---

## Phase 1: Review & Understand

### Step 1.1: Read Investigation Report
File: `XP_POTION_INVESTIGATION.md`

**Key Points:**
- First purchase works because `user_potions` row doesn't exist
- Second purchase should work with ON CONFLICT logic
- The 500 error was likely a database error that wasn't being logged
- Cap logic was correct but error handling was insufficient

### Step 1.2: Review Changes
File: `XP_POTION_CHANGES_DIFF.md`

**Key Changes:**
- Route handler now logs database errors
- Cap check uses 409 (Conflict) instead of 400 (Bad Request)
- Separate messages for "at max" vs "would exceed max"
- Database constraint added to enforce cap

### Step 1.3: Review Summary
File: `XP_POTION_FIX_SUMMARY.md`

**Overview:**
- 5 files changed
- 1 migration added
- All error codes and messages documented

---

## Phase 2: Database Migration

### Step 2.1: Backup Database
```bash
# Neon backup
pg_dump $DATABASE_URL > backup-xp-potion-$(date +%Y%m%d-%H%M%S).sql

# Or use Neon's built-in backup
# https://console.neon.tech/app/projects/[project]/backups
```

**Action:** Confirm backup exists before proceeding.

### Step 2.2: Apply Migration
```bash
# Option 1: Using psql
psql $DATABASE_URL < migrations/2026-11-07-xp-potion-cap-constraint.sql

# Option 2: Using Neon SQL Editor
# Copy contents of migration and execute
```

**Expected Output:**
```
ALTER TABLE
ALTER TABLE
```

**Action:** Verify migration applied successfully.

### Step 2.3: Verify Migration
```sql
-- Check constraint exists
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'user_potions' AND constraint_name = 'user_potions_quantity_check';

-- Check constraint definition
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'user_potions_quantity_check';
```

**Expected Results:**
- Constraint exists with type 'CHECK'
- Check clause: `quantity >= 0 AND quantity <= 2`

---

## Phase 3: Code Changes

### Step 3.1: Review Code Changes
All changes are already applied to:
- `src/app/api/store/xp-boost/route.ts` ✓
- `src/lib/db/xp-boost.ts` ✓
- `src/components/dashboard/xp-badge.tsx` ✓
- `src/lib/db/xp-boost.test.ts` ✓

**Action:** No code changes needed (already done).

### Step 3.2: Run Tests
```bash
# Run xp-boost tests
npm test -- src/lib/db/xp-boost.test.ts

# Expected output:
# ✓ compra uma poção por 250 moedas e devolve o saldo e inventário atualizados
# ✓ permite a segunda poção por mais 250 moedas, mas rejeita a terceira sem alterar o saldo
# ✓ rejeita saldo insuficiente sem debitar moedas nem conceder poção
# ✓ não cobra nem concede novamente quando a mesma compra é reenviada
```

**Action:** All tests should pass.

---

## Phase 4: Manual Testing

### Step 4.1: Test Scenario 1 - Buy First Potion
1. Open dashboard
2. Click XP badge to open menu
3. Verify: "Você possui: 0 / 2"
4. Click "Comprar · 250"
5. **Expected:** Button shows spinner briefly, then succeeds
6. **Verify:** "Você possui: 1 / 2", coins decreased by 250

### Step 4.2: Test Scenario 2 - Buy Second Potion
1. Click "Comprar · 250" again
2. **Expected:** Button shows spinner briefly, then succeeds
3. **Verify:** "Você possui: 2 / 2", coins decreased by 250 more
4. **Verify:** "Comprar" button is now disabled (shows "Cheio")

### Step 4.3: Test Scenario 3 - Try to Buy Third Potion (Cap Reached)
1. Try to click "Comprar" button (should be disabled)
2. **Expected:** Button is disabled, cannot click
3. **Verify:** Error message shows: "Você já possui o máximo de poções."
4. **Verify:** No spinner stuck, button returns to normal state
5. **Verify:** Coins unchanged

### Step 4.4: Test Scenario 4 - Insufficient Coins
1. Use a test profile with < 250 coins
2. Click "Comprar · 250"
3. **Expected:** Button shows spinner briefly, then fails
4. **Verify:** Error message shows: "Moedas insuficientes."
5. **Verify:** No spinner stuck, button returns to normal state
6. **Verify:** Coins unchanged, potion count unchanged

### Step 4.5: Test Scenario 5 - Idempotency
1. Buy a potion
2. Immediately click "Comprar" again (before response)
3. **Expected:** Request is cached, same response returned
4. **Verify:** Only one potion added, coins deducted once

### Step 4.6: Test Scenario 6 - No Connection Leaks
1. Monitor server logs during tests
2. **Expected:** No repeated "[db] New client connected" messages
3. **Verify:** Each request uses the singleton pool

---

## Phase 5: Error Scenarios

### Step 5.1: Test Error Logging
1. Trigger an error (e.g., by manually breaking the database connection)
2. Try to buy a potion
3. **Expected:** 500 error returned to client
4. **Verify:** Server logs show "[xp-boost POST] Unexpected error:" with details

### Step 5.2: Test Error Messages
1. Test each error scenario:
   - Not enough coins: "Moedas insuficientes." (400)
   - Already at max: "Você já possui o máximo de poções." (409)
   - Would exceed max: "Seu inventário está cheio (2/2)." (409)
2. **Verify:** Error messages are displayed in the UI
3. **Verify:** No spinner stuck after error

---

## Phase 6: Deployment

### Step 6.1: Deploy Code
```bash
git add .
git commit -m "fix: xp potion purchase error handling and cap enforcement"
git push origin main

# Vercel will auto-deploy
```

### Step 6.2: Monitor Logs
```bash
vercel logs --follow

# Watch for:
# - "[xp-boost POST] Unexpected error" messages (should be rare)
# - "[db] New client connected" spam (should not happen)
```

### Step 6.3: Verify in Production
```bash
# Test the purchase flow in production
# 1. Buy 1 potion (should succeed)
# 2. Buy 2nd potion (should succeed)
# 3. Try 3rd potion (should fail with 409)
# 4. Check error message is displayed
```

---

## Phase 7: Rollback Plan

If issues occur:

### Rollback Code
```bash
git revert [commit-hash]
git push origin main
```

### Rollback Migration
```sql
-- Remove the constraint
alter table user_potions drop constraint if exists user_potions_quantity_check;
```

### Restore Database
```bash
# Restore from backup
psql $DATABASE_URL < backup-xp-potion-YYYYMMDD-HHMMSS.sql
```

---

## Success Criteria

- ✅ Migration applies without errors
- ✅ All tests pass
- ✅ Buy 1 potion (succeeds)
- ✅ Buy 2nd potion (succeeds)
- ✅ Try 3rd potion (fails with 409 and clear message)
- ✅ Button doesn't stay on loading spinner after error
- ✅ Try buying with < 250 coins (fails with 400 and clear message)
- ✅ Coins unchanged after failed purchase
- ✅ No connection leaks after error
- ✅ Error messages displayed in UI
- ✅ Server logs show detailed errors for debugging

---

## Timeline

| Phase | Task | Estimated Time |
|-------|------|-----------------|
| 1 | Review & Understand | 10 min |
| 2 | Database Migration | 5 min |
| 3 | Code Changes & Tests | 5 min |
| 4 | Manual Testing | 20 min |
| 5 | Error Scenarios | 10 min |
| 6 | Deployment | 5 min |
| **Total** | | **55 min** |

---

## Support

For questions or issues:
1. Check `XP_POTION_INVESTIGATION.md` for root cause analysis
2. Check `XP_POTION_CHANGES_DIFF.md` for detailed changes
3. Check `XP_POTION_FIX_SUMMARY.md` for overview
4. Review server logs for "[xp-boost POST] Unexpected error" messages
5. Run test script: `npx ts-node scripts/test-potion-purchase.ts`
