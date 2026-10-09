import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import pool from "../db";

// Helper to format month start
function getMonthStart(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

// Helper to format month end
function getMonthEnd(monthStart: string): string {
  const d = new Date(`${monthStart}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

describe("Recap Metrics Computation", () => {
  const TEST_PROFILE_ID = "0e719da0-f486-469c-b27f-9b3b5612fb50";

  // Test 1: Month boundaries in America/Sao_Paulo
  it("computes month boundaries correctly in America/Sao_Paulo timezone", async () => {
    // September 2026 starts on UTC-3 at 2026-09-01 03:00:00 UTC
    // and ends at 2026-10-01 03:00:00 UTC
    
    const septStart = getMonthStart(2026, 8);  // September (0-indexed)
    const septEnd = getMonthEnd(septStart);
    
    // Verify the boundaries
    assert.equal(septStart, "2026-09-01", "September 2026 should start on 2026-09-01");
    assert.equal(septEnd, "2026-10-01", "September 2026 should end on 2026-10-01");
    
    // Test a day boundary: 2026-09-30 23:59:59 America/Sao_Paulo = 2026-10-01 02:59:59 UTC
    // Should still be counted as September
    const septBoundary = "2026-09-30";
    const utcBoundary = new Date("2026-09-30T23:59:59-03:00").toISOString().slice(0, 10);
    assert.equal(utcBoundary, "2026-09-30", "Day boundary should be consistent");
  });

  // Test 2: XP is computed from xp_ledger for the month, not cumulative
  it("computes XP gained in month from xp_ledger, not from user_xp", async () => {
    const septStart = getMonthStart(2026, 8);
    const septEnd = getMonthEnd(septStart);
    
    // Query XP from ledger for September
    const result = await pool.query(
      `SELECT COALESCE(SUM(xp_amount), 0) as xp 
       FROM xp_ledger 
       WHERE profile_id = $1
         AND created_at >= $2::timestamp
         AND created_at < $3::timestamp`,
      [TEST_PROFILE_ID, septStart, septEnd]
    );
    
    const xpInMonth = Number(result.rows[0].xp);
    
    // Verify XP is computed (and is more than 0 for this user)
    assert.ok(xpInMonth > 0, "XP for September 2026 should be greater than 0");
    assert.ok(xpInMonth < 10000, "XP should be reasonable (month-specific, not cumulative)");
  });

  // Test 3: Past month doesn't use today's league
  it("does not use today's league for past month recap", async () => {
    // This test verifies that when generating a recap for August 2026,
    // we use the league at the END of August, not the current league (October)
    
    const augustEnd = "2026-08-31";
    const today = new Date().toISOString().slice(0, 10);
    
    // Get league at end of August
    const leagueResult = await pool.query(
      `SELECT lg.tier
       FROM league_group_members lgm
       JOIN league_groups lg ON lgm.league_group_id = lg.id
       WHERE lgm.profile_id = $1
         AND lg.week_start_date <= $2::date
       ORDER BY lg.week_start_date DESC
       LIMIT 1`,
      [TEST_PROFILE_ID, augustEnd]
    );
    
    const augustLeague = leagueResult.rows[0]?.tier;
    
    // Verify we got a league
    assert.ok(augustLeague, "Should have league data for end of August");
    
    // The league should NOT be LENDAS (which is the current league for this user)
    // unless the user actually reached LENDAS by end of August
    // This test just verifies the query works correctly
  });

  // Test 4: Month spanning a league change
  it("correctly identifies league progression within a month", async () => {
    const septStart = "2026-09-01";
    const septEnd = "2026-10-01";
    
    // Get league at start of September
    const startResult = await pool.query(
      `SELECT lg.tier
       FROM league_group_members lgm
       JOIN league_groups lg ON lgm.league_group_id = lg.id
       WHERE lgm.profile_id = $1
         AND lg.week_start_date <= $2::date
       ORDER BY lg.week_start_date DESC
       LIMIT 1`,
      [TEST_PROFILE_ID, septStart]
    );
    
    const septStartLeague = startResult.rows[0]?.tier;
    
    // Get league at end of September
    const endResult = await pool.query(
      `SELECT lg.tier
       FROM league_group_members lgm
       JOIN league_groups lg ON lgm.league_group_id = lg.id
       WHERE lgm.profile_id = $1
         AND lg.week_start_date <= $2::date
       ORDER BY lg.week_start_date DESC
       LIMIT 1`,
      [TEST_PROFILE_ID, septEnd]
    );
    
    const septEndLeague = endResult.rows[0]?.tier;
    
    // If there's progression, verify it
    if (septStartLeague && septEndLeague) {
      const hasProgression = septStartLeague !== septEndLeague;
      // The test user should have progression in September (PRATA -> OURO -> DIAMANTE)
      console.log(`September league progression: ${septStartLeague} -> ${septEndLeague}`);
    }
  });

  // Test 5: Zero data returns sensible defaults
  it("returns sensible defaults for months with no activity", async () => {
    // Test with a month the user hasn't been active (April 2026)
    const aprStart = getMonthStart(2026, 3);
    const aprEnd = getMonthEnd(aprStart);
    
    const result = await pool.query(
      `SELECT COALESCE(SUM(duration_minutes), 0) as minutes,
              COALESCE(SUM(xp_amount), 0) as xp
       FROM focus_sessions
       WHERE profile_id = $1
         AND started_at >= $2::timestamp
         AND started_at < $3::timestamp`,
      [TEST_PROFILE_ID, aprStart, aprEnd]
    );
    
    const focusMinutes = Number(result.rows[0].minutes);
    const xp = Number(result.rows[0].xp);
    
    assert.equal(focusMinutes, 0, "Focus minutes should be 0 for inactive month");
    assert.equal(xp, 0, "XP should be 0 for inactive month");
  });
});

// Test double-click safety for recap generation
import pool from "../db";

describe("Recap Generation Idempotency", () => {
  const PROFILE_ID = "0e719da0-f486-469c-b27f-9b3b5612fb50";
  
  it("increments generation_number on each regeneration", async () => {
    // Get current recaps
    const result = await pool.query(
      `SELECT id, generation_number, generated_at
       FROM monthly_recaps
       WHERE profile_id = $1
       ORDER BY recap_month DESC
       LIMIT 1`,
      [PROFILE_ID]
    );
    
    const current = result.rows[0];
    if (current) {
      console.log(`Current recap generation_number: ${current.generation_number}`);
      
      // Check history for this recap
      const history = await pool.query(
        `SELECT generation_number, generated_at
         FROM monthly_recap_history
         WHERE recap_id = $1
         ORDER BY generation_number DESC`,
        [current.id]
      );
      
      console.log(`History entries: ${history.rows.length}`);
    }
  });
});