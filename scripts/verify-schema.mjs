#!/usr/bin/env node
/**
 * Schema-sync health check — run in CI or before deployment.
 *
 *   node scripts/verify-schema.mjs
 *
 * Fails (non-zero exit) if any CRITICAL schema invariant is violated:
 *   - all expected columns on profile_daily_tasks / daily_task_log
 *   - xp_ledger_source_check CHECK constraint includes ALL valid sources
 *   - daily_task_log primary key on (task_id, log_date) for idempotent check-ins
 *
 * This is the guard that would have caught the original regression at boot
 * time instead of after a user hit a 500.
 */

// Load .env BEFORE importing db.ts (which reads DATABASE_URL at module scope).
if (!process.env.DATABASE_URL) {
  const { readFileSync } = await import("node:fs");
  try {
    const content = readFileSync(".env", "utf8");
    for (const line of content.split("\n")) {
      const idx = line.indexOf("=");
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim();
        if (key === "DATABASE_URL" || key === "DATABASE_SSL_STRICT") {
          process.env[key] = val;
        }
      }
    }
  } catch {
    // No .env — rely on real environment variables (CI).
  }
}

const { verifySchema } = await import("../src/lib/db/schema-check.ts");
const pool = (await import("../src/lib/db.ts")).default;

const result = await verifySchema();

if (result.issues.length > 0) {
  console.error("Schema issues found:");
  for (const issue of result.issues) {
    console.error(`  [${issue.severity.toUpperCase()}] ${issue.table}: ${issue.issue}`);
  }
}

await pool.end();

if (!result.ok) {
  console.error("FAIL: schema does not match application expectations.");
  process.exit(1);
}

console.log("OK: schema is in sync with application expectations.");
