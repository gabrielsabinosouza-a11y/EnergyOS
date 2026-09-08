/**
 * Recomputes user_xp.total_xp from the xp_ledger (source of truth) for every
 * profile, fixing drift where accumulated totals diverged from the ledger.
 *
 * Run: npm run db:recompute-xp -- --apply   (preview without --apply)
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));

async function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const envFile of [".env.local", ".env"]) {
    try {
      const contents = await readFile(join(here, "..", envFile), "utf8");
      const match = contents.match(/^DATABASE_URL=(.*)$/m);
      if (match?.[1]) return match[1].trim();
    } catch {
      // arquivo opcional
    }
  }
  return undefined;
}

const apply = process.argv.includes("--apply");

const connectionString = await resolveDatabaseUrl();
if (!connectionString) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl:
    /neon\.tech/.test(connectionString)
      ? { rejectUnauthorized: process.env.NODE_ENV === "production" }
      : undefined,
});

try {
  const { rows } = await pool.query(`
    select p.id as profile_id,
           coalesce(ux.total_xp, 0) as current_xp,
           coalesce(l.ledger_xp, 0) as correct_xp
    from profiles p
    left join user_xp ux on ux.profile_id = p.id
    left join (
      select profile_id, sum(xp_amount)::int as ledger_xp
      from xp_ledger
      group by profile_id
    ) l on l.profile_id = p.id
    order by p.id
  `);

  const changed = rows.filter(
    (r) => Number(r.current_xp) !== Number(r.correct_xp),
  );

  console.log(`Perfis: ${rows.length} | com divergência: ${changed.length}\n`);
  for (const r of changed) {
    console.log(
      `${r.profile_id.slice(0, 8)}…  ${r.current_xp} → ${r.correct_xp}  (Δ ${Number(r.correct_xp) - Number(r.current_xp)})`,
    );
  }

  if (!apply) {
    console.log("\nNenhuma escrita feita. Rode com --apply para aplicar.");
    await pool.end();
    process.exit(0);
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const r of changed) {
      await client.query(
        `insert into user_xp (profile_id, total_xp, level, updated_at)
         values ($1, $2, 1, now())
         on conflict (profile_id) do update
           set total_xp = excluded.total_xp, updated_at = now()`,
        [r.profile_id, Number(r.correct_xp)],
      );
    }
    await client.query("commit");
    console.log(`✓ ${changed.length} usuário(s) atualizado(s).`);
  } catch (e) {
    await client.query("rollback");
    console.error("✗ rollback:", e instanceof Error ? e.message : e);
    process.exit(1);
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}