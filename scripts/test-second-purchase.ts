import pool from "../src/lib/db";
import { purchaseXpBoost } from "../src/lib/db/xp-boost";

async function testSecondPurchase() {
  console.log("=== TESTING SECOND POTION PURCHASE ===\n");

  const profileId = "test-profile-" + Date.now();
  const idempotencyKey1 = "12c0c318-66e7-4f70-9364-756d0c461713";
  const idempotencyKey2 = "bfcf21b8-3ec4-4d05-a528-9707b1fab431";

  try {
    // Setup
    console.log("1. Setting up test profile...");
    await pool.query(
      `INSERT INTO profiles (id, display_name, email) VALUES ($1, $2, $3)`,
      [profileId, "Test User", "test@example.com"]
    );
    await pool.query(
      `INSERT INTO user_settings (profile_id, coins) VALUES ($1, $2)`,
      [profileId, 1000]
    );
    console.log("   ✓ Profile created\n");

    // First purchase
    console.log("2. First purchase...");
    try {
      const result1 = await purchaseXpBoost(profileId, 1, idempotencyKey1);
      console.log(`   ✓ Success: balance=${result1.balance}, quantity=${result1.quantity}\n`);
    } catch (error) {
      console.error(`   ✗ Failed: ${error instanceof Error ? error.message : String(error)}\n`);
      throw error;
    }

    // Check state after first purchase
    console.log("3. Checking state after first purchase...");
    const settings1 = await pool.query(
      `SELECT coins FROM user_settings WHERE profile_id = $1`,
      [profileId]
    );
    const potions1 = await pool.query(
      `SELECT quantity FROM user_potions WHERE profile_id = $1 AND item_type = $2`,
      [profileId, "xp_boost_2x"]
    );
    console.log(`   Coins: ${settings1.rows[0]?.coins}`);
    console.log(`   Potions: ${potions1.rows[0]?.quantity ?? 0}\n`);

    // Second purchase
    console.log("4. Second purchase...");
    try {
      const result2 = await purchaseXpBoost(profileId, 1, idempotencyKey2);
      console.log(`   ✓ Success: balance=${result2.balance}, quantity=${result2.quantity}\n`);
    } catch (error) {
      console.error(`   ✗ Failed: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error) {
        console.error(`   Stack: ${error.stack}`);
      }
      console.error();
      throw error;
    }

    // Check state after second purchase
    console.log("5. Checking state after second purchase...");
    const settings2 = await pool.query(
      `SELECT coins FROM user_settings WHERE profile_id = $1`,
      [profileId]
    );
    const potions2 = await pool.query(
      `SELECT quantity FROM user_potions WHERE profile_id = $1 AND item_type = $2`,
      [profileId, "xp_boost_2x"]
    );
    console.log(`   Coins: ${settings2.rows[0]?.coins}`);
    console.log(`   Potions: ${potions2.rows[0]?.quantity ?? 0}\n`);

    console.log("=== TEST PASSED ===");
  } catch (error) {
    console.error("\n=== TEST FAILED ===");
    console.error(error);
    process.exit(1);
  } finally {
    // Cleanup
    try {
      await pool.query(`DELETE FROM xp_boost_purchase_requests WHERE profile_id = $1`, [profileId]);
      await pool.query(`DELETE FROM user_potions WHERE profile_id = $1`, [profileId]);
      await pool.query(`DELETE FROM user_settings WHERE profile_id = $1`, [profileId]);
      await pool.query(`DELETE FROM profiles WHERE id = $1`, [profileId]);
    } catch (e) {
      console.error("Cleanup failed:", e);
    }
    await pool.end();
  }
}

testSecondPurchase().catch(console.error);
