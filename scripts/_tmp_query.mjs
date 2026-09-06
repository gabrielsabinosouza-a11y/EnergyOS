import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
const here = dirname(fileURLToPath(import.meta.url));
const contents = await readFile(join(here, "..", ".env"), "utf8");
const match = contents.match(/^DATABASE_URL=(.*)$/m);
const connectionString = match[1].trim();
const pool = new pg.Pool({ connectionString });
try {
  const r = await pool.query(`select g.id,g.name,g.created_by, m.profile_id,p.display_name,p.email, m.role
    from groups g join group_members m on m.group_id=g.id join profiles p on p.id=m.profile_id
    where g.name ilike '%bora%' order by m.group_id`);
  console.table(r.rows);
} finally { await pool.end(); }
