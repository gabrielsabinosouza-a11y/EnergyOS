import pool from "../src/lib/db";

async function testPotionPurchase() {
  console.log("=== XP POTION PURCHASE TEST ===\n");

  const profileId = "test-profile-" + Date.now();
  const idempotencyKey1 = "12c0c318-66e7-4f70-9364-756d0c461713";
  const idempotencyKey2 = "bfcf21b8-3ec4-4d05-a528-9707b1fab431";

  try {
    // Setup: Create test profile and settings
    console.log("1. Setting up test profile...");
    await pool.query(
      `INSERT INTO profiles (id, display_name, email) VALUES ($1, $2, $3)`,
      [profileId, "Test User", "test@example.com"]
    );
    await pool.query(
      `INSERT INTO user_settings (profile_id, coins) VALUES ($1, $2)`,
      [profileId, 1000]
    );
    console.log("   ✓ Profile created with 1000 coins\n");

    // Test 1: First purchase
    console.log("2. First purchase (1 potion)...");
    try {
      const result1 = await pool.query(
        `SELECT * FROM user_potions WHERE profile_id = $1 AND item_type = $2`,
        [profileId, "xp_boost_2x"]
      );
      console.log(`   Before: ${result1.rows.length} rows in user_potions`);

      // Simulate the purchase logic
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Check inventory
        const inv1 = await client.query(
          `SELECT quantity FROM user_potions WHERE profile_id = $1 AND item_type = $2 FOR UPDATE`,
          [profileId, "xp_boost_2x"]
        );
        const qty1 = inv1.rows[0]?.quantity ?? 0;
        console.log(`   Current quantity: ${qty1}`);

        // Check cap
        if (qty1 + 1 > 2) {
          throw new Error("Inventory full");
        }

        // Deduct coins
        await client.query(
          `UPDATE user_settings SET coins = coins - $1 WHERE profile_id = $2`,
          [250, profileId]
        );

        // Upsert inventory
        const upsert1 = await client.query(
          `INSERT INTO user_potions (profile_id, item_type, quantity, updated_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (profile_id, item_type)
           DO UPDATE SET quantity = user_potions.quantity + excluded.quantity, updated_at = now()
           RETURNING quantity`,
          [profileId, "xp_boost_2x", 1]
        );
        console.log(`   After upsert: quantity = ${upsert1.rows[0]?.quantity}`);

        // Record purchase
        await client.query(
          `INSERT INTO xp_boost_purchase_requests
           (profile_id, idempotency_key, requested_quantity, balance, potion_quantity)
           VALUES ($1, $2, $3, $4, $5)`,
          [profileId, idempotencyKey1, 1, 750, upsert1.rows[0]?.quantity]
        );

        await client.query("COMMIT");
        console.log("   ✓ First purchase successful\n");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`   ✗ First purchase failed: ${error instanceof Error ? error.message : String(error)}\n`);
      throw error;
    }

    // Test 2: Second purchase
    console.log("3. Second purchase (1 potion)...");
    try {
      const result2 = await pool.query(
        `SELECT * FROM user_potions WHERE profile_id = $1 AND item_type = $2`,
        [profileId, "xp_boost_2x"]
      );
      console.log(`   Before: ${result2.rows.length} rows, quantity = ${result2.rows[0]?.quantity}`);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Check inventory
        const inv2 = await client.query(
          `SELECT quantity FROM user_potions WHERE profile_id = $1 AND item_type = $2 FOR UPDATE`,
          [profileId, "xp_boost_2x"]
        );
        const qty2 = inv2.rows[0]?.quantity ?? 0;
        console.log(`   Current quantity: ${qty2}`);

        // Check cap
        if (qty2 + 1 > 2) {
          throw new Error("Inventory full (cap reached)");
        }

        // Deduct coins
        const coins = await pool.query(
          `SELECT coins FROM user_settings WHERE profile_id = $1`,
          [profileId]
        );
        console.log(`   Current coins: ${coins.rows[0]?.coins}`);

        await client.query(
          `UPDATE user_settings SET coins = coins - $1 WHERE profile_id = $2`,
          [250, profileId]
        );

        // Upsert inventory
        const upsert2 = await client.query(
          `INSERT INTO user_potions (profile_id, item_type, quantity, updated_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (profile_id, item_type)
           DO UPDATE SET quantity = user_potions.quantity + excluded.quantity, updated_at = now()
           RETURNING quantity`,
          [profileId, "xp_boost_2x", 1]
        );
        console.log(`   After upsert: quantity = ${upsert2.rows[0]?.quantity}`);

        // Record purchase
        await client.query(
          `INSERT INTO xp_boost_purchase_requests
           (profile_id, idempotency_key, requested_quantity, balance, potion_quantity)
           VALUES ($1, $2, $3, $4, $5)`,
          [profileId, idempotencyKey2, 1, 500, upsert2.rows[0]?.quantity]
        );

        await client.query("COMMIT");
        console.log("   ✓ Second purchase successful\n");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`   ✗ Second purchase failed: ${error instanceof Error ? error.message : String(error)}\n`);
      throw error;
    }

    // Test 3: Third purchase (should fail)
    console.log("4. Third purchase (should fail - cap reached)...");
    try {
      const result3 = await pool.query(
        `SELECT * FROM user_potions WHERE profile_id = $1 AND item_type = $2`,
        [profileId, "xp_boost_2x"]
      );
      console.log(`   Before: quantity = ${result3.rows[0]?.quantity}`);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const inv3 = await client.query(
          `SELECT quantity FROM user_potions WHERE profile_id = $1 AND item_type = $2 FOR UPDATE`,
          [profileId, "xp_boost_2x"]
        );
        const qty3 = inv3.rows[0]?.quantity ?? 0;
        console.log(`   Current quantity: ${qty3}`);

        if (qty3 + 1 > 2) {
          throw new Error("Inventory full (cap reached)");
        }

        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("cap reached")) {
        console.log(`   ✓ Correctly rejected: ${error.message}\n`);
      } else {
        throw error;
      }
    }

    // Cleanup
    console.log("5. Cleaning up...");
    await pool.query(`DELETE FROM xp_boost_purchase_requests WHERE profile_id = $1`, [profileId]);
    await pool.query(`DELETE FROM user_potions WHERE profile_id = $1`, [profileId]);
    await pool.query(`DELETE FROM user_settings WHERE profile_id = $1`, [profileId]);
    await pool.query(`DELETE FROM profiles WHERE id = $1`, [profileId]);
    console.log("   ✓ Cleanup complete\n");

    console.log("=== ALL TESTS PASSED ===");
  } catch (error) {
    console.error("\n=== TEST FAILED ===");
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testPotionPurchase().catch(console.error);
