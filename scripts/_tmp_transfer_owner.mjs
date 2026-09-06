import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const contents = await readFile(join(here, "..", ".env"), "utf8");
const match = contents.match(/^DATABASE_URL=(.*)$/m);
const connectionString = match[1].trim();
const pool = new pg.Pool({ connectionString });

const GROUP_ID = 3; // "BORA BUSCAR"
const NEW_OWNER = "0e719da0-f486-469c-b27f-9b3b5612fb50"; // CAFEINADO / pciskolargx@gmail.com
const OLD_OWNER = "61429bab-d36a-41c5-a4f1-e128ca5efc38"; // Fabão

try {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const r1 = await client.query(
      `update group_members set role = 'OWNER', is_banned = false
       where group_id = $1 and profile_id = $2`,
      [GROUP_ID, NEW_OWNER],
    );
    const r2 = await client.query(
      `update group_members set role = 'ADMIN'
       where group_id = $1 and profile_id = $2 and role = 'OWNER'`,
      [GROUP_ID, OLD_OWNER],
    );
    const r3 = await client.query(
      `update groups set created_by = $2 where id = $1`,
      [GROUP_ID, NEW_OWNER],
    );
    await client.query("commit");
    console.log("group_members NEW_OWNER rows:", r1.rowCount);
    console.log("group_members OLD_OWNER rows:", r2.rowCount);
    console.log("groups.created_by rows:", r3.rowCount);
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  const check = await pool.query(
    `select g.id, g.name, g.created_by, m.profile_id, p.display_name, m.role
     from groups g join group_members m on m.group_id = g.id
     join profiles p on p.id = m.profile_id
     where g.id = $1 order by m.group_id`,
    [GROUP_ID],
  );
  console.table(check.rows);
} finally {
  await pool.end();
}