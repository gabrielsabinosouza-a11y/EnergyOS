const { Client } = require("pg");
const fs = require("fs");
const line = fs.readFileSync("/home/cafe/Documents/Projects/EnergyOS/.env","utf8").split("\n").find(l=>l.startsWith("DATABASE_URL="));
const c = new Client({ connectionString: line.slice("DATABASE_URL=".length) });
(async () => {
  await c.connect();
  const dups = await c.query(`select count(*)::int n from (
      select profile_id, source, source_id, count(*) c
      from xp_ledger group by profile_id, source, source_id having count(*) > 1) d`);
  console.log("dup groups:", dups.rows[0].n);
  const srcs = await c.query(`select source, count(*)::int n from xp_ledger group by source order by n desc`);
  console.log("sources:", JSON.stringify(srcs.rows));
  const total = await c.query(`select count(*)::int n from xp_ledger`);
  console.log("total rows:", total.rows[0].n);
  await c.end();
})();
