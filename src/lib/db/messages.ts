import pool from "../db";
import type { DirectMessage } from "@/types";
import { parseMessage, parseProfileId, ValidationError } from "./validation";
import { assertFriends, getUserByUsername, sendFriendRequest } from "./social";
import { ConflictError, NotFoundError } from "../errors";

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
  const text = parseMessage(body);

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
  // Consistent with the rest of the DM surface: reads are only recorded
  // between friends.
  await assertFriends(profileId, other);
  await pool.query(
    `insert into dm_reads (profile_id, other_id, read_at)
     values ($1, $2, now())
     on conflict (profile_id, other_id) do update set read_at = now()`,
    [profileId, other],
  );
}

/**
 * Start a direct chat with a user by their username (@ handle)
 * If the users are not already friends, this will:
 * 1. Send a friend request to the other user
 * 2. Return the conversation info with a pending status
 * If they are already friends, it will return the existing conversation
 */
export async function startDirectChatByUsername(
  profileId: string,
  username: string,
): Promise<{
  conversationWith: {
    id: string;
    displayName: string;
    username: string;
    photoUrl?: string;
  };
  isFriend: boolean;
  friendRequestSent: boolean;
}> {
  parseProfileId(profileId);
  
  if (!username || username.length < 2) {
    throw new ValidationError("Username inválido.");
  }
  
  // Find the user by username
  const targetUser = await getUserByUsername(username);
  if (!targetUser) {
    throw new NotFoundError(`Usuário @${username} não encontrado.`);
  }
  
  // Check if already friends
  const areFriendsResult = await pool.query<{ count: string | number }>(
    `select count(*)::int as count from friendships
     where status = 'accepted'
       and least(requester_id, addressee_id) = least($1::text, $2::text)
       and greatest(requester_id, addressee_id) = greatest($1::text, $2::text)`,
    [profileId, targetUser.id],
  );
  
  const isFriend = Number(areFriendsResult.rows[0]?.count ?? 0) > 0;
  
  let friendRequestSent = false;
  
  // If not friends, send a friend request
  if (!isFriend) {
    try {
      await sendFriendRequest(profileId, targetUser.id);
      friendRequestSent = true;
    } catch (error) {
      // If friend request already pending, that's fine
      if (error instanceof ConflictError) {
        friendRequestSent = true;
      } else {
        throw error;
      }
    }
  }
  
  return {
    conversationWith: {
      id: targetUser.id,
      displayName: targetUser.displayName,
      username: targetUser.username,
      photoUrl: targetUser.photoUrl,
    },
    isFriend,
    friendRequestSent,
  };
}

/**
 * Send a direct message to a user by their username
 * This will automatically send a friend request if not already friends
 */
export async function sendDirectMessageByUsername(
  profileId: string,
  username: string,
  body: string,
): Promise<DirectMessage> {
  parseProfileId(profileId);
  const text = parseMessage(body);
  
  // Find the user by username
  const targetUser = await getUserByUsername(username);
  if (!targetUser) {
    throw new NotFoundError(`Usuário @${username} não encontrado.`);
  }
  
  // Check if already friends
  const areFriendsResult = await pool.query<{ count: string | number }>(
    `select count(*)::int as count from friendships
     where status = 'accepted'
       and least(requester_id, addressee_id) = least($1::text, $2::text)
       and greatest(requester_id, addressee_id) = greatest($1::text, $2::text)`,
    [profileId, targetUser.id],
  );
  
  const isFriend = Number(areFriendsResult.rows[0]?.count ?? 0) > 0;
  
  // If not friends, send a friend request first
  if (!isFriend) {
    try {
      await sendFriendRequest(profileId, targetUser.id);
    } catch (error) {
      // If friend request already pending, that's fine - we can still send the message
      if (!(error instanceof ConflictError)) {
        throw error;
      }
    }
    
    // Since they're not friends yet, we store the message but it won't be delivered
    // until friendship is established
    const result = await pool.query<DmRow>(
      `insert into direct_messages (sender_id, recipient_id, body)
       values ($1, $2, $3)
       returning id, sender_id, recipient_id, body, created_at`,
      [profileId, targetUser.id, text],
    );
    return mapDm(result.rows[0]);
  }
  
  // If already friends, send the message normally
  const result = await pool.query<DmRow>(
    `insert into direct_messages (sender_id, recipient_id, body)
     values ($1, $2, $3)
     returning id, sender_id, recipient_id, body, created_at`,
    [profileId, targetUser.id, text],
  );
  return mapDm(result.rows[0]);
}
