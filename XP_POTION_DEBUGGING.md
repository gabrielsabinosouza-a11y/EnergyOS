# XP Potion Purchase - Debugging Guide

## Current Status

You're getting a 500 error on the second purchase. I've added detailed logging to help diagnose the issue.

## What I Found

The code changes have been applied, but there's a 500 error happening. The logging I added will help us see exactly where it's failing.

## Next Steps

### Step 1: Apply the Migration

The CHECK constraint migration hasn't been applied yet. This might be causing the issue. Apply it:

```bash
psql $DATABASE_URL < migrations/2026-11-07-xp-potion-cap-constraint.sql
```

### Step 2: Check the Logs

After applying the migration, try the purchase again and check the server logs for:

```
[xp-boost] Cap check failed: { currentQuantity: X, quantity: Y, XP_BOOST_MAX_HELD: 2 }
[xp-boost] Upserting potion inventory: { profileId: ..., currentQuantity: X, quantity: Y, targetQuantity: Z }
[xp-boost] Upsert result: { rows: X, quantity: Y }
[xp-boost POST] Unexpected error: { message: "...", code: "...", detail: "..." }
```

### Step 3: Report the Logs

Once you see the error logs, share them with me. The logs will show:
- Whether the cap check is passing or failing
- Whether the upsert is succeeding or failing
- What the actual database error is (if any)

## Possible Issues

1. **Migration not applied**: The CHECK constraint might not exist, causing a database error
2. **Race condition**: Two concurrent purchases might be interfering
3. **Database error**: The ON CONFLICT clause might be failing for some reason
4. **Coin deduction**: The coin deduction might be failing

## How to Debug

1. Open browser DevTools (F12)
2. Go to Network tab
3. Try to buy the second potion
4. Look at the POST request to `/api/store/xp-boost`
5. Check the Response tab for the error message
6. Check the server console for the detailed logs

## Files Modified

- `src/lib/db/xp-boost.ts` - Added logging to cap check and upsert
- `src/app/api/store/xp-boost/route.ts` - Already has detailed error logging

## What to Do

1. Apply the migration
2. Try the purchase again
3. Share the server logs
4. I'll help you fix the actual issue
