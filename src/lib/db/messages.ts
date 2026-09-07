import pool from "../db";
import type { DirectMessage, MessageReactionSummary } from "@/types";
import { parseEnum, parseMessage, parseProfileId, ValidationError } from "./validation";
import { assertFriends, getUserByUsername, sendFriendRequest } from "./social";
import { ConflictError, NotFoundError } from "../errors";

/** Detect whether a column exists on the direct_messages table (cached). */
const dmColumnCache = new Map<string, Promise<boolean>>();
function hasDmColumn(column: string): Promise<boolean> {
  if (!dmColumnCache.has(column)) {
    dmColumnCache.set(
      column,
      pool
        .query<{ exists: boolean }>(
          `select exists (
             select 1 from information_schema.columns
             where table_name = 'direct_messages' and column_name = $1
           ) as exists`,
          [column],
        )
        .then((r) => r.rows[0]?.exists ?? false)
        .catch(() => false),
    );
  }
  return dmColumnCache.get(column)!;
}

interface DmRow {
  id: string | number;
  sender_id: string;
  recipient_id: string;
  body: string | null;
  created_at: Date | string;
  message_type?: string | null;
  media_url?: string | null;
  media_duration_seconds?: string | number | null;
  media_file_name?: string | null;
  media_mime_type?: string | null;
  media_size_bytes?: string | number | null;
  reply_to_id?: string | number | null;
  reply_to_body?: string | null;
  reply_to_sender_name?: string | null;
  edited_at?: Date | string | null;
  reactions?: unknown;
  is_pinned?: boolean | null;
  pinned_at?: Date | string | null;
  pinned_by?: string | null;
}

function normalizeReactions(value: unknown): MessageReactionSummary[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const emoji = typeof row.emoji === "string" ? row.emoji : "";
      const count = Number(row.count ?? 0);
      const userNames = Array.isArray(row.userNames)
        ? row.userNames.filter((name): name is string => typeof name === "string")
        : [];
      if (!emoji || count <= 0) return null;
      return {
        emoji,
        count,
        userNames,
        reactedByMe: Boolean(row.reactedByMe),
      };
    })
    .filter((item): item is MessageReactionSummary => item !== null);
}

function mapDm(row: DmRow): DirectMessage {
  return {
    id: Number(row.id),
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    body: row.body ?? "",
    messageType: row.message_type ? (row.message_type as DirectMessage["messageType"]) : undefined,
    mediaUrl: row.media_url ?? undefined,
    mediaDurationSeconds:
      row.media_duration_seconds != null ? Number(row.media_duration_seconds) : undefined,
    mediaFileName: row.media_file_name ?? undefined,
    mediaMimeType: row.media_mime_type ?? undefined,
    mediaSizeBytes: row.media_size_bytes != null ? Number(row.media_size_bytes) : undefined,
    createdAt: new Date(row.created_at).toISOString(),
    replyToId: row.reply_to_id != null ? Number(row.reply_to_id) : undefined,
    replyToBody: row.reply_to_body ?? undefined,
    replyToSenderName: row.reply_to_sender_name ?? undefined,
    editedAt: row.edited_at ? new Date(row.edited_at).toISOString() : undefined,
    reactions: normalizeReactions(row.reactions),
    isPinned: Boolean(row.is_pinned),
    pinnedAt: row.pinned_at ? new Date(row.pinned_at).toISOString() : undefined,
    pinnedBy: row.pinned_by ?? undefined,
  };
}

function dmConversationId(a: string, b: string): string {
  return [a, b].sort().join(":");
}

const DM_INTERACTION_SELECT = `left join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'emoji', grouped.emoji,
      'count', grouped.reaction_count,
      'userNames', grouped.user_names,
      'reactedByMe', grouped.reacted_by_me
    ) order by grouped.emoji), '[]'::jsonb) as reactions
    from (
      select mr.emoji,
             count(*)::int as reaction_count,
             array_agg(p.display_name order by p.display_name) as user_names,
             bool_or(mr.user_id = $1) as reacted_by_me
      from message_reactions mr
      join profiles p on p.id = mr.user_id
      where mr.message_kind = 'DM' and mr.message_id = dm.id
      group by mr.emoji
    ) grouped
  ) reactions on true
  left join pinned_messages pinned
    on pinned.message_kind = 'DM'
   and pinned.conversation_id = least(dm.sender_id, dm.recipient_id) || ':' || greatest(dm.sender_id, dm.recipient_id)
   and pinned.message_id = dm.id`;

const DM_SELECT = `select dm.id, dm.sender_id, dm.recipient_id, dm.body, dm.created_at, dm.edited_at,
  dm.message_type, dm.media_url, dm.media_duration_seconds, dm.media_file_name, dm.media_mime_type, dm.media_size_bytes,
  dm.reply_to_id, rp.body as reply_to_body, rp.sender_id as reply_sender_id,
  p.display_name as reply_to_sender_name,
  reactions.reactions, (pinned.message_id is not null) as is_pinned,
  pinned.created_at as pinned_at, pinned.pinned_by
  from direct_messages dm
  left join direct_messages rp on rp.id = dm.reply_to_id
  left join profiles p on p.id = rp.sender_id
  ${DM_INTERACTION_SELECT}`;

export async function listDirectMessages(
  profileId: string,
  otherId: string,
  afterId?: number,
): Promise<DirectMessage[]> {
  parseProfileId(profileId);
  const other = parseProfileId(otherId);
  await assertFriends(profileId, other);

  // The reply/edit/media columns may not exist on older databases until the
  // migration runs; detect them so the query stays valid either way.
  const hasReplyCols = await hasDmColumn("reply_to_id");
  const mediaColumnState = await Promise.all(
    ["message_type", "media_url", "media_duration_seconds", "media_file_name", "media_mime_type", "media_size_bytes"]
      .map((column) => hasDmColumn(column)),
  );
  const hasMediaCols = mediaColumnState.every(Boolean);
  const baseColumns = `dm.id, dm.sender_id, dm.recipient_id, dm.body, dm.created_at,
    reactions.reactions, (pinned.message_id is not null) as is_pinned, pinned.created_at as pinned_at, pinned.pinned_by`;
  const replyColumns = hasReplyCols
    ? `, dm.edited_at, dm.reply_to_id, rp.body as reply_to_body, p.display_name as reply_to_sender_name`
    : `, null::timestamptz as edited_at, null::bigint as reply_to_id, null::text as reply_to_body, null::text as reply_to_sender_name`;
  const mediaColumns = hasMediaCols
    ? `    , dm.message_type, dm.media_url, dm.media_duration_seconds, dm.media_file_name, dm.media_mime_type, dm.media_size_bytes`
    : `, null::text as message_type, null::text as media_url, null::int as media_duration_seconds, null::text as media_file_name, null::text as media_mime_type, null::bigint as media_size_bytes`;
  const FROM = hasReplyCols
    ? ` from direct_messages dm
        left join direct_messages rp on rp.id = dm.reply_to_id
        left join profiles p on p.id = rp.sender_id
        ${DM_INTERACTION_SELECT}`
    : ` from direct_messages dm
        ${DM_INTERACTION_SELECT}`;

  const result = afterId
    ? await pool.query<DmRow>(
        `select ${baseColumns}${replyColumns}${mediaColumns}
         ${FROM}
         where least(dm.sender_id, dm.recipient_id) = least($1::text, $2::text)
           and greatest(dm.sender_id, dm.recipient_id) = greatest($1::text, $2::text)
           and dm.id > $3
         order by dm.created_at asc
         limit 100`,
        [profileId, other, afterId],
      )
    : await pool.query<DmRow>(
        `select ${baseColumns}${replyColumns}${mediaColumns}
         ${FROM}
         where least(dm.sender_id, dm.recipient_id) = least($1::text, $2::text)
           and greatest(dm.sender_id, dm.recipient_id) = greatest($1::text, $2::text)
         order by dm.created_at desc
         limit 80`,
        [profileId, other],
      );

  const rows = afterId ? result.rows : [...result.rows].reverse();
  return rows.map(mapDm);
}

async function assertDmMessageParticipant(profileId: string, messageId: number): Promise<DmRow> {
  parseProfileId(profileId);
  if (!Number.isInteger(messageId) || messageId <= 0) throw new ValidationError("Mensagem inválida.");
  const result = await pool.query<DmRow>(
    `select id, sender_id, recipient_id, body, created_at, reply_to_id, edited_at
     from direct_messages
     where id = $1`,
    [messageId],
  );
  const message = result.rows[0];
  if (!message) throw new NotFoundError("Mensagem não encontrada.");
  const otherId = message.sender_id === profileId ? message.recipient_id : message.sender_id;
  if (message.sender_id !== profileId && message.recipient_id !== profileId) {
    throw new NotFoundError("Mensagem não encontrada.");
  }
  await assertFriends(profileId, otherId);
  return message;
}

export async function sendDirectMessage(
  profileId: string,
  otherId: string,
  body: string,
  opts?: { messageType?: string; mediaUrl?: string; mediaDurationSeconds?: number; mediaFileName?: string; mediaMimeType?: string; mediaSizeBytes?: number; replyToId?: number },
): Promise<DirectMessage> {
  parseProfileId(profileId);
  const other = parseProfileId(otherId);
  await assertFriends(profileId, other);

  const messageType = (opts?.messageType ?? "TEXT") as "TEXT" | "IMAGE" | "VIDEO" | "STICKER" | "AUDIO" | "DOCUMENT";
  const allowed = ["TEXT", "IMAGE", "VIDEO", "STICKER", "AUDIO", "DOCUMENT"] as const;
  if (!allowed.includes(messageType)) throw new ValidationError("Tipo de mensagem inválido.");

  let text: string | null = null;
  if (messageType === "TEXT") {
    text = parseMessage(body);
  } else if (body && body.trim()) {
    text = body.trim().slice(0, 1000);
  }

  const mediaUrl = opts?.mediaUrl?.trim() || null;
  if (mediaUrl && mediaUrl.length > 2000) throw new ValidationError("URL de mídia inválida.");
  if (messageType !== "TEXT" && messageType !== "STICKER" && !mediaUrl) {
    throw new ValidationError("Mensagem de mídia requer uma URL.");
  }

  const mediaDurationSeconds =
    opts?.mediaDurationSeconds != null && Number.isFinite(opts.mediaDurationSeconds)
      ? Math.max(0, Math.round(opts.mediaDurationSeconds))
      : null;
  if (messageType === "VIDEO" && mediaDurationSeconds != null && mediaDurationSeconds > 30) {
    throw new ValidationError("Vídeos devem ter no máximo 30 segundos.");
  }
  if (messageType === "AUDIO" && mediaDurationSeconds != null && mediaDurationSeconds > 120) {
    throw new ValidationError("Áudios devem ter no máximo 2 minutos.");
  }
  const mediaSizeBytes = opts?.mediaSizeBytes != null ? Number(opts.mediaSizeBytes) : null;
  if (mediaSizeBytes != null && (!Number.isInteger(mediaSizeBytes) || mediaSizeBytes < 0 || mediaSizeBytes > 20 * 1024 * 1024)) throw new ValidationError("Arquivo de mídia inválido.");
  if (messageType === "STICKER" && !text) {
    text = opts?.mediaUrl?.trim() || null;
  }

  // Reply columns may not exist on older DBs until migration runs.
  const hasReplyCols = await hasDmColumn("reply_to_id");
  const effectiveReplyId = hasReplyCols ? opts?.replyToId : undefined;
  if (effectiveReplyId != null) {
    const reply = await assertDmMessageParticipant(profileId, effectiveReplyId);
    const isSameConversation =
      [reply.sender_id, reply.recipient_id].sort().join(":") === dmConversationId(profileId, other);
    if (!isSameConversation) throw new ValidationError("Mensagem respondida inválida.");
  }

  const mediaColumnState = await Promise.all(
    ["message_type", "media_url", "media_duration_seconds", "media_file_name", "media_mime_type", "media_size_bytes"]
      .map((column) => hasDmColumn(column)),
  );
  const hasMediaCols = mediaColumnState.every(Boolean);
  const hasMedia = messageType !== "TEXT";
  if (hasMedia && !hasMediaCols) throw new ValidationError("Mensagens de mídia indisponíveis.");

  const result = await pool.query<DmRow>(
    hasReplyCols && hasMediaCols
      ? `insert into direct_messages (sender_id, recipient_id, body, message_type, media_url, media_duration_seconds, media_file_name, media_mime_type, media_size_bytes, reply_to_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         returning id, sender_id, recipient_id, body, message_type, media_url, media_duration_seconds, media_file_name, media_mime_type, media_size_bytes, created_at, reply_to_id`
      : hasReplyCols
        ? `insert into direct_messages (sender_id, recipient_id, body, reply_to_id)
           values ($1, $2, $3, $4)
           returning id, sender_id, recipient_id, body, created_at, reply_to_id`
        : `insert into direct_messages (sender_id, recipient_id, body)
           values ($1, $2, $3)
           returning id, sender_id, recipient_id, body, created_at`,
    hasReplyCols && hasMediaCols
      ? [profileId, other, text, messageType, mediaUrl, mediaDurationSeconds, opts?.mediaFileName?.slice(0, 255) ?? null, opts?.mediaMimeType?.slice(0, 120) ?? null, mediaSizeBytes, effectiveReplyId ?? null]
      : hasReplyCols
        ? [profileId, other, text, effectiveReplyId ?? null]
        : [profileId, other, text],
  );
  const row = result.rows[0];
  // Fetch join info for reply
  if (hasReplyCols && hasMediaCols && effectiveReplyId != null && row.reply_to_id != null) {
    const full = await pool.query<DmRow>(
      `${DM_SELECT}
       where dm.id = $2`,
      [profileId, row.id],
    );
    return mapDm(full.rows[0]);
  }
  return mapDm(row);
}

export async function toggleDirectMessageReaction(
  profileId: string,
  messageId: number,
  emojiValue: unknown,
): Promise<DirectMessage> {
  const emoji = parseEnum(emojiValue, ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const, "Emoji");
  const message = await assertDmMessageParticipant(profileId, messageId);
  const existing = await pool.query(
    `select 1 from message_reactions
     where message_kind = 'DM' and message_id = $1 and user_id = $2 and emoji = $3`,
    [messageId, profileId, emoji],
  );
  if (existing.rows[0]) {
    await pool.query(
      `delete from message_reactions
       where message_kind = 'DM' and message_id = $1 and user_id = $2 and emoji = $3`,
      [messageId, profileId, emoji],
    );
  } else {
    await pool.query(
      `insert into message_reactions (message_id, message_kind, user_id, emoji)
       values ($1, 'DM', $2, $3)
       on conflict (message_id, message_kind, user_id, emoji) do nothing`,
      [messageId, profileId, emoji],
    );
  }
  const otherId = message.sender_id === profileId ? message.recipient_id : message.sender_id;
  const messages = await listDirectMessages(profileId, otherId);
  return messages.find((item) => item.id === messageId) ?? mapDm(message);
}

export async function toggleDirectMessagePin(
  profileId: string,
  messageId: number,
): Promise<{ pinned: boolean }> {
  const message = await assertDmMessageParticipant(profileId, messageId);
  const conversationId = dmConversationId(message.sender_id, message.recipient_id);
  const existing = await pool.query(
    `select 1 from pinned_messages
     where message_kind = 'DM' and conversation_id = $1 and message_id = $2`,
    [conversationId, messageId],
  );
  if (existing.rows[0]) {
    await pool.query(
      `delete from pinned_messages
       where message_kind = 'DM' and conversation_id = $1 and message_id = $2`,
      [conversationId, messageId],
    );
    return { pinned: false };
  }
  await pool.query(
    `delete from pinned_messages where message_kind = 'DM' and conversation_id = $1`,
    [conversationId],
  );
  await pool.query(
    `insert into pinned_messages (message_id, message_kind, conversation_id, pinned_by)
     values ($1, 'DM', $2, $3)
     on conflict (message_id, message_kind) do update
     set conversation_id = excluded.conversation_id,
         pinned_by = excluded.pinned_by,
         created_at = now()`,
    [messageId, conversationId, profileId],
  );
  return { pinned: true };
}

/** Return the active pin for a direct-message conversation, if one exists. */
export async function getDirectPinnedMessages(
  profileId: string,
  otherId: string,
): Promise<DirectMessage[]> {
  const messages = await listDirectMessages(profileId, otherId);
  return messages.filter((message) => message.isPinned);
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

export async function editDirectMessage(
  profileId: string,
  messageId: number,
  newBody: string,
): Promise<DirectMessage> {
  parseProfileId(profileId);
  const text = parseMessage(newBody);
  const result = await pool.query<DmRow>(
    `update direct_messages
     set body = $1, edited_at = now()
     where id = $2 and sender_id = $3
     returning id, sender_id, recipient_id, body, created_at, reply_to_id, edited_at`,
    [text, messageId, profileId],
  );
  if (!result.rows[0]) throw new NotFoundError("Mensagem não encontrada.");
  return mapDm(result.rows[0]);
}

export async function deleteDirectMessage(
  profileId: string,
  messageId: number,
): Promise<void> {
  parseProfileId(profileId);
  const result = await pool.query(
    `delete from direct_messages
     where id = $1 and sender_id = $2`,
    [messageId, profileId],
  );
  if (result.rowCount === 0) throw new NotFoundError("Mensagem não encontrada.");
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
