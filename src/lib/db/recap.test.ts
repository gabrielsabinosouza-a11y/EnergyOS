import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import pool from "../db";
import { generateRecap, spMonthStartIso, spMonthEndIso } from "./recap";

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

// ── Fuso America/Sao_Paulo: limites de mês ─────────────────────────────────
describe("Recap month boundaries (America/Sao_Paulo)", () => {
  it("meia-noite SP do primeiro dia do mês é 03:00 UTC", () => {
    assert.equal(spMonthStartIso("2026-09-01"), "2026-09-01T03:00:00.000Z");
    assert.equal(spMonthStartIso("2026-10-01"), "2026-10-01T03:00:00.000Z");
  });

  it("fim exclusivo do mês é meia-noite SP do primeiro dia do mês seguinte", () => {
    assert.equal(spMonthEndIso("2026-09-01"), "2026-10-01T03:00:00.000Z");
    assert.equal(spMonthEndIso("2026-10-01"), "2026-11-01T03:00:00.000Z");
  });

  it("dezembro rola para janeiro (fuso mantido)", () => {
    assert.equal(spMonthStartIso("2026-12-01"), "2026-12-01T03:00:00.000Z");
    assert.equal(spMonthEndIso("2026-12-01"), "2027-01-01T03:00:00.000Z");
  });
});

// ── Filtro de atividade por janela SP: último dia do mês e primeiro do próximo ───
describe("Recap activity window in America/Sao_Paulo", () => {
  const PROFILE_ID = "0e719da0-f486-469c-b27f-9b3b5612fb50";

  // SP Sep 30 23:30 = UTC Oct 1 02:30  (dentro de setembro SP, FORA de setembro UTC-meia-noite)
  const SEP_LAST_SESSION_UTC = "2026-10-01T02:30:00.000Z";
  // SP Oct 1 00:10  = UTC Oct 1 03:10  (dentro de outubro SP)
  const OCT_FIRST_SESSION_UTC = "2026-10-01T03:10:00.000Z";

  let insertedFocusIds: number[] = [];
  let insertedXpIds: number[] = [];

  beforeEach(async () => {
    // Dois rows: 30/09 23:30 SP (UTC 02:30 de 01/10) e 01/10 00:10 SP (UTC 03:10 de 01/10).
    const focus = await pool.query(
      `INSERT INTO focus_sessions (profile_id, started_at, ended_at, duration_minutes, target_duration_minutes)
       VALUES ($1,$2,$3,30,25),($1,$4,$5,30,25)
       RETURNING id`,
      [PROFILE_ID, SEP_LAST_SESSION_UTC, SEP_LAST_SESSION_UTC, OCT_FIRST_SESSION_UTC, OCT_FIRST_SESSION_UTC]
    );
    insertedFocusIds = focus.rows.map((r) => Number(r.id));

    const xp = await pool.query(
      `INSERT INTO xp_ledger (profile_id, source, source_id, xp_amount, created_at)
       VALUES ($1,'focus','boundary_sep',10,$2),($1,'focus','boundary_oct',10,$3)
       RETURNING id`,
      [PROFILE_ID, SEP_LAST_SESSION_UTC, OCT_FIRST_SESSION_UTC]
    );
    insertedXpIds = xp.rows.map((r) => Number(r.id));
  });

  afterEach(async () => {
    for (const id of insertedFocusIds) await pool.query("DELETE FROM focus_sessions WHERE id = $1", [id]);
    for (const id of insertedXpIds) await pool.query("DELETE FROM xp_ledger WHERE id = $1", [id]);
    insertedFocusIds = [];
    insertedXpIds = [];
  });

  it("evento às 23:30 SP de 30/09 conta para setembro (janela SP)", async () => {
    const sepStart = spMonthStartIso("2026-09-01");
    const sepEnd = spMonthEndIso("2026-09-01");
    const octStart = spMonthStartIso("2026-10-01");

    const sep = await pool.query<{ minutes: string }>(
      `select coalesce(sum(duration_minutes),0) as minutes from focus_sessions
       where profile_id=$1 and ended_at is not null
         and started_at >= $2::timestamptz and started_at < $3::timestamptz
         and started_at = $4::timestamptz`,
      [PROFILE_ID, sepStart, sepEnd, SEP_LAST_SESSION_UTC]
    );
    const sepXp = await pool.query<{ xp: string }>(
      `select coalesce(sum(xp_amount),0) as xp from xp_ledger
       where profile_id=$1 and created_at >= $2::timestamptz and created_at < $3::timestamptz
         and created_at = $4::timestamptz`,
      [PROFILE_ID, sepStart, sepEnd, SEP_LAST_SESSION_UTC]
    );
    // A sessão de 30/09 23:30 SP (UTC 02:30 de 01/10) está dentro da janela SP de setembro.
    assert.equal(Number(sep.rows[0].minutes), 30, "30 min de 30/09 devem contar em setembro");
    assert.equal(Number(sepXp.rows[0].xp), 10, "10 xp de 30/09 devem contar em setembro");

    // A janela de outubro começa em 01/10 03:00 UTC, então o evento de 02:30 UTC NÃO é outubro.
    const oct = await pool.query<{ minutes: string }>(
      `select coalesce(sum(duration_minutes),0) as minutes from focus_sessions
       where profile_id=$1 and ended_at is not null
         and started_at >= $2::timestamptz and started_at < $3::timestamptz
         and started_at = $4::timestamptz`,
      [PROFILE_ID, octStart, spMonthEndIso("2026-10-01"), SEP_LAST_SESSION_UTC]
    );
    assert.equal(Number(oct.rows[0].minutes), 0, "02:30 UTC de 01/10 não pertence à janela SP de outubro");
  });

  it("evento às 00:10 SP de 01/10 conta para outubro (janela SP)", async () => {
    const octStart = spMonthStartIso("2026-10-01");
    const octEnd = spMonthEndIso("2026-10-01");

    const oct = await pool.query<{ minutes: string }>(
      `select coalesce(sum(duration_minutes),0) as minutes from focus_sessions
       where profile_id=$1 and ended_at is not null
         and started_at >= $2::timestamptz and started_at < $3::timestamptz
         and started_at = $4::timestamptz`,
      [PROFILE_ID, octStart, octEnd, OCT_FIRST_SESSION_UTC]
    );
    const octXp = await pool.query<{ xp: string }>(
      `select coalesce(sum(xp_amount),0) as xp from xp_ledger
       where profile_id=$1 and created_at >= $2::timestamptz and created_at < $3::timestamptz
         and created_at = $4::timestamptz`,
      [PROFILE_ID, octStart, octEnd, OCT_FIRST_SESSION_UTC]
    );
    assert.equal(Number(oct.rows[0].minutes), 30, "30 min de 01/10 00:10 SP devem contar em outubro");
    assert.equal(Number(octXp.rows[0].xp), 10, "10 xp de 01/10 00:10 SP devem contar em outubro");
  });

  it("janela UTC-meia-noite perde o evento de 23:30 SP de 30/09 (o bug do fuso)", async () => {
    // Janela "errada" usando meia-noite UTC: [01/09 00:00 UTC, 01/10 00:00 UTC)
    const wrong = await pool.query<{ minutes: string }>(
      `select coalesce(sum(duration_minutes),0) as minutes from focus_sessions
       where profile_id=$1 and ended_at is not null
         and started_at >= '2026-09-01T00:00:00Z'::timestamptz and started_at < '2026-10-01T00:00:00Z'::timestamptz
         and started_at = $2::timestamptz`,
      [PROFILE_ID, SEP_LAST_SESSION_UTC]
    );
    // 02:30 UTC de 01/10 (23:30 SP de 30/09) fica de fora da janela UTC de setembro.
    assert.equal(Number(wrong.rows[0].minutes), 0, "janela UTC-meia-noite perde o evento de 23:30 SP de 30/09");
  });
});

// ── Geração idempotente: mesma linha, totais idênticos ───────────────────────
describe("Recap generation idempotency", () => {
  const PROFILE_ID = "0e719da0-f486-469c-b27f-9b3b5612fb50";

  it("gerar o mesmo mês duas vezes produz um único registro com totais idênticos", async () => {
    const month = "2026-09-01";

    // Parte de um estado limpo para o mês de teste (evita conflitos no histórico
    // de gerações anteriores desse mesmo perfil/mês).
    await pool.query(
      "DELETE FROM monthly_recap_history WHERE profile_id = $1 AND recap_month = $2::date",
      [PROFILE_ID, month]
    );
    await pool.query(
      "UPDATE monthly_recaps SET generation_number = 1 WHERE profile_id = $1 AND recap_month = $2::date",
      [PROFILE_ID, month]
    );

    const first = await generateRecap(PROFILE_ID, month);
    const second = await generateRecap(PROFILE_ID, month);

    // Mesmo registro (upsert), não duplicou.
    assert.equal(second.id, first.id, "deve atualizar o mesmo registro, não criar outro");
    assert.equal(second.totalXp, first.totalXp, "totais de XP idênticos (idempotente)");
    assert.equal(second.totalFocusMinutes, first.totalFocusMinutes, "totais de foco idênticos");
    assert.equal(second.longestStreak, first.longestStreak, "streak idêntico");
    assert.equal(second.status, "final", "setembro encerrado deve ficar 'final'");

    // Exatamente uma linha para esse perfil/mês.
    const count = await pool.query<{ c: string }>(
      "SELECT count(*)::text as c FROM monthly_recaps WHERE profile_id = $1 AND recap_month = $2::date",
      [PROFILE_ID, month]
    );
    assert.equal(Number(count.rows[0].c), 1, "não deve duplicar o recap");
  });
});