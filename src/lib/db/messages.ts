import pool from "../db";
import type { DirectMessage } from "@/types";
import { parseProfileId, parseTitle, ValidationError } from "./validation";
import { assertFriends } from "./social";

interface DmRow {
  id: string | number;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: Date | string;
}

function mapDm(row: DmRow): DirectMessage {
  return {
    id: Number(row.id),
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function listDirectMessages(
  profileId: string,
  otherId: string,
  afterId?: number,
): Promise<DirectMessage[]> {
  parseProfileId(profileId);
  const other = parseProfileId(otherId);
  await assertFriends(profileId, other);

  const result = afterId
    ? await pool.query<DmRow>(
        `select id, sender_id, recipient_id, body, created_at
         from direct_messages
         where least(sender_id, recipient_id) = least($1::text, $2::text)
           and greatest(sender_id, recipient_id) = greatest($1::text, $2::text)
           and id > $3
         order by created_at asc
         limit 100`,
        [profileId, other, afterId],
      )
    : await pool.query<DmRow>(
        `select id, sender_id, recipient_id, body, created_at
         from direct_messages
         where least(sender_id, recipient_id) = least($1::text, $2::text)
           and greatest(sender_id, recipient_id) = greatest($1::text, $2::text)
         order by created_at desc
         limit 80`,
        [profileId, other],
      );

  const rows = afterId ? result.rows : [...result.rows].reverse();
  return rows.map(mapDm);
}

export async function sendDirectMessage(profileId: string, otherId: string, body: string): Promise<DirectMessage> {
  parseProfileId(profileId);
  const other = parseProfileId(otherId);
  await assertFriends(profileId, other);
  const text = parseTitle(body, "Mensagem");
  if (text.length > 2000) throw new ValidationError("Mensagem deve ter no máximo 2000 caracteres.");

  const result = await pool.query<DmRow>(
    `insert into direct_messages (sender_id, recipient_id, body)
     values ($1, $2, $3)
     returning id, sender_id, recipient_id, body, created_at`,
    [profileId, other, text],
  );
  return mapDm(result.rows[0]);
}

export async function markDmRead(profileId: string, otherId: string): Promise<void> {
  parseProfileId(profileId);
  const other = parseProfileId(otherId);
  await pool.query(
    `insert into dm_reads (profile_id, other_id, read_at)
     values ($1, $2, now())
     on conflict (profile_id, other_id) do update set read_at = now()`,
    [profileId, other],
  );
}
