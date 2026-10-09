// Diagnostic: Reproduce the exact ensureDailyTasksSchema failure
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

function loadEnv() {
  const file = readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
  for (const line of file.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    let val = trimmed.slice(eq + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

const connectionString = process.env.DATABASE_URL;
const isNeon = /neon\.tech/.test(connectionString);
const client = new pg.Client({ connectionString, ssl: isNeon ? { rejectUnauthorized: false } : undefined });

try {
  await client.connect();

  // Run the EXACT SQL from ensureDailyTasksSchema() that touches xp_ledger
  console.log("\n=== Step 1: Drop constraint (from ensureDailyTasksSchema) ===");
  try {
    await client.query(`
      do $$ begin
        alter table xp_ledger drop constraint if exists xp_ledger_source_check;
      exception when undefined_object then null;
      end $$;
    `);
    console.log("Drop: OK");
  } catch (e) {
    console.error("Drop FAILED:", e.message);
  }

  console.log("\n=== Step 2: Add constraint WITHOUT weekly_plan (from ensureDailyTasksSchema) ===");
  try {
    await client.query(`
      do $$ begin
        alter table xp_ledger add constraint xp_ledger_source_check
          check (source in ('task','kanban','kanban_task','focus','streak_bonus','daily_quest','daily_task','checkin','checkin_streak','goal','achievement'));
        raise notice 'CONSTRAINT ADDED';
      exception when duplicate_object then null;
      end $$;
    `);
    console.log("Add: OK — constraint was added");
  } catch (e) {
    console.error("Add FAILED — THIS IS THE ROOT CAUSE:");
    console.error("  Error:", e.message);
    console.error("  Code:", e.code);
    console.error("  Detail:", e.detail);
  }

  // Verify constraint state
  console.log("\n=== Current xp_ledger constraints after test ===");
  const after = await client.query(
    `select conname, pg_get_constraintdef(oid) as condef from pg_constraint where conrelid = 'xp_ledger'::regclass`
  );
  console.log(after.rows);

  // Check for the violating row
  console.log("\n=== The violating row (source='weekly_plan_occurrence') ===");
  const violator = await client.query(
    `select id, profile_id, source, source_id from xp_ledger where source = 'weekly_plan_occurrence'`
  );
  console.log(violator.rows);

} catch (error) {
  console.error("Error:", error);
} finally {
  await client.end();
}
