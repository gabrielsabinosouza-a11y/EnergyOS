import pool from "../db";
import type { FriendRequest, FriendSummary, PublicProfile, UserSearchResult } from "@/types";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors";
import { parseProfileId, parseTitle, ValidationError } from "./validation";
import { computeStreak } from "./tasks";
import { getWeeklyFocusMinutesForProfiles } from "./focus";
import { sundayWeekStartIso, todayIso } from "./dates";
import { listAchievementProgress } from "./achievements";

interface ProfileLiteRow {
  id: string;
  display_name: string;
  username: string | null;
  photo_url: string | null;
  last_active_at: Date | string | null;
  current_streak: number | null;
}

function mapLite(row: ProfileLiteRow) {
  return {
    id: row.id,
    displayName: row.display_name,
    username: row.username ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    lastActiveAt: row.last_active_at ? new Date(row.last_active_at).toISOString() : undefined,
    currentStreak: row.current_streak ?? 0,
  };
}

export async function searchUsers(profileId: string, query: string): Promise<UserSearchResult[]> {
  parseProfileId(profileId);
  const q = query.trim();
  if (q.length < 2) throw new ValidationError("Digite pelo menos 2 caracteres para buscar.");
  if (q.length > 80) throw new ValidationError("Busca muito longa.");

  const result = await pool.query<
    ProfileLiteRow & {
      friendship_id: string | number | null;
      requester_id: string | null;
      addressee_id: string | null;
      status: string | null;
    }
  >(
    `select p.id, p.display_name, p.username, p.photo_url, p.last_active_at, p.current_streak,
            f.id as friendship_id, f.requester_id, f.addressee_id, f.status
     from profiles p
     left join friendships f
       on (least(f.requester_id, f.addressee_id) = least(p.id, $1)
       and greatest(f.requester_id, f.addressee_id) = greatest(p.id, $1))
     where p.id <> $1
       and (
         p.display_name ilike $2
         or coalesce(p.username, '') ilike $2
         or coalesce(p.email, '') ilike $2
       )
     order by p.display_name asc
     limit 20`,
    [profileId, `%${q}%`],
  );

  return result.rows.map((row) => {
    let relation: UserSearchResult["relation"] = "none";
    if (row.status === "accepted") relation = "friends";
    else if (row.status === "pending" && row.requester_id === profileId) relation = "pending_outgoing";
    else if (row.status === "pending" && row.addressee_id === profileId) relation = "pending_incoming";
    return {
      id: row.id,
      displayName: row.display_name,
      username: row.username ?? undefined,
      photoUrl: row.photo_url ?? undefined,
      relation,
    };
  });
}

export async function listFriends(profileId: string): Promise<FriendSummary[]> {
  parseProfileId(profileId);
  const result = await pool.query<
    ProfileLiteRow & { friendship_id: string | number; unread: string | number }
  >(
    `select p.id, p.display_name, p.username, p.photo_url, p.last_active_at, p.current_streak,
            f.id as friendship_id,
            (
              select count(*)::int from direct_messages dm
              where dm.sender_id = p.id and dm.recipient_id = $1
                and dm.created_at > coalesce(
                  (select read_at from dm_reads r where r.profile_id = $1 and r.other_id = p.id),
                  'epoch'::timestamptz
                )
            ) as unread
     from friendships f
     join profiles p on p.id = case when f.requester_id = $1 then f.addressee_id else f.requester_id end
     where f.status = 'accepted' and (f.requester_id = $1 or f.addressee_id = $1)
     order by p.last_active_at desc nulls last, p.display_name asc`,
    [profileId],
  );

  return result.rows.map((row) => ({
    ...mapLite(row),
    friendshipId: Number(row.friendship_id),
    unreadCount: Number(row.unread),
  }));
}

export async function listFriendRequests(profileId: string): Promise<FriendRequest[]> {
  parseProfileId(profileId);
  const result = await pool.query<
    ProfileLiteRow & {
      friendship_id: string | number;
      created_at: Date | string;
      requester_id: string;
    }
  >(
    `select f.id as friendship_id, f.created_at, f.requester_id,
            p.id, p.display_name, p.username, p.photo_url, p.last_active_at, p.current_streak
     from friendships f
     join profiles p on p.id = case when f.requester_id = $1 then f.addressee_id else f.requester_id end
     where f.status = 'pending' and (f.requester_id = $1 or f.addressee_id = $1)
     order by f.created_at desc`,
    [profileId],
  );

  return result.rows.map((row) => ({
    id: Number(row.friendship_id),
    direction: row.requester_id === profileId ? "outgoing" : "incoming",
    createdAt: new Date(row.created_at).toISOString(),
    user: {
      id: row.id,
      displayName: row.display_name,
      username: row.username ?? undefined,
      photoUrl: row.photo_url ?? undefined,
    },
  }));
}

export async function sendFriendRequest(profileId: string, addresseeId: string): Promise<{ status: "pending" | "accepted" }> {
  parseProfileId(profileId);
  const otherId = parseProfileId(addresseeId);
  if (otherId === profileId) throw new ValidationError("Você não pode adicionar a si mesmo.");

  const other = await pool.query(`select id from profiles where id = $1`, [otherId]);
  if (!other.rows[0]) throw new NotFoundError("Usuário não encontrado.");

  const existing = await pool.query<{
    id: string | number;
    requester_id: string;
    addressee_id: string;
    status: string;
  }>(
    `select id, requester_id, addressee_id, status from friendships
     where least(requester_id, addressee_id) = least($1::text, $2::text)
       and greatest(requester_id, addressee_id) = greatest($1::text, $2::text)`,
    [profileId, otherId],
  );

  const row = existing.rows[0];
  if (row?.status === "accepted") throw new ConflictError("Vocês já são amigos.");
  if (row?.status === "pending" && row.requester_id === profileId) {
    throw new ConflictError("Pedido já enviado.");
  }
  if (row?.status === "pending" && row.addressee_id === profileId) {
    await pool.query(
      `update friendships set status = 'accepted', accepted_at = now() where id = $1`,
      [row.id],
    );
    return { status: "accepted" };
  }

  await pool.query(
    `insert into friendships (requester_id, addressee_id, status) values ($1, $2, 'pending')`,
    [profileId, otherId],
  );
  return { status: "pending" };
}

export async function acceptFriendRequest(profileId: string, friendshipId: number): Promise<void> {
  parseProfileId(profileId);
  const result = await pool.query(
    `update friendships set status = 'accepted', accepted_at = now()
     where id = $1 and addressee_id = $2 and status = 'pending'`,
    [friendshipId, profileId],
  );
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Pedido não encontrado.");
}

export async function declineOrCancelFriendship(profileId: string, friendshipId: number): Promise<void> {
  parseProfileId(profileId);
  const result = await pool.query(
    `delete from friendships
     where id = $1 and (requester_id = $2 or addressee_id = $2)`,
    [friendshipId, profileId],
  );
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Relação não encontrada.");
}

export async function areFriends(profileId: string, otherId: string): Promise<boolean> {
  const result = await pool.query(
    `select 1 from friendships
     where status = 'accepted'
       and least(requester_id, addressee_id) = least($1::text, $2::text)
       and greatest(requester_id, addressee_id) = greatest($1::text, $2::text)`,
    [profileId, otherId],
  );
  return Boolean(result.rows[0]);
}

export async function assertFriends(profileId: string, otherId: string): Promise<void> {
  if (!(await areFriends(profileId, otherId))) {
    throw new ForbiddenError("Vocês precisam ser amigos para isso.");
  }
}

export async function getBasicPublicProfile(viewerId: string, targetId: string): Promise<PublicProfile> {
  parseProfileId(viewerId);
  const otherId = parseProfileId(targetId);
  if (viewerId === otherId) return getPublicProfile(viewerId, otherId);

  const result = await pool.query<ProfileLiteRow & { longest_streak: number | null; created_at: Date | string | null; role: string | null; equipped_decoration_id: string | null; has_custom_banner: boolean | null; banner_image_url: string | null }>(
    `select id, display_name, username, photo_url, last_active_at, current_streak, longest_streak, created_at, role, equipped_decoration_id, has_custom_banner, banner_image_url
     from profiles where id = $1`,
    [otherId],
  );
  if (!result.rows[0]) throw new NotFoundError("Perfil não encontrado.");

  const row = result.rows[0];
  const weekStart = sundayWeekStartIso(todayIso());
  const [minutesMap, achievements] = await Promise.all([
    getWeeklyFocusMinutesForProfiles([otherId], weekStart),
    listAchievementProgress(otherId),
  ]);
  const featured = achievements
    .filter((item) => item.isFeatured && item.unlockedTier > 0)
    .sort((a, b) => (a.featuredOrder ?? 99) - (b.featuredOrder ?? 99));

  return {
    id: row.id,
    displayName: row.display_name,
    username: row.username ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    role: (row.role as "user" | "admin" | null) ?? "user",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    lastActiveAt: row.last_active_at ? new Date(row.last_active_at).toISOString() : undefined,
    currentStreak: row.current_streak ?? 0,
    longestStreak: row.longest_streak ?? 0,
    weeklyFocusMinutes: minutesMap.get(otherId) ?? 0,
    equippedDecorationId: row.equipped_decoration_id ?? undefined,
    hasCustomBanner: row.has_custom_banner ?? false,
    bannerImageUrl: row.banner_image_url ?? undefined,
    achievements: [],
    featuredAchievements: featured,
    isFriend: false,
    isOwner: false,
  };
}

export async function getPublicProfile(viewerId: string, targetId: string): Promise<PublicProfile> {
  parseProfileId(viewerId);
  const otherId = parseProfileId(targetId);
  const isOwner = viewerId === otherId;
  if (!isOwner) await assertFriends(viewerId, otherId);

  const result = await pool.query<ProfileLiteRow & { longest_streak: number | null; created_at: Date | string | null; role: string | null; equipped_decoration_id: string | null; has_custom_banner: boolean | null; banner_image_url: string | null }>(
    `select id, display_name, username, photo_url, last_active_at, current_streak, longest_streak, created_at, role, equipped_decoration_id, has_custom_banner, banner_image_url
     from profiles where id = $1`,
    [otherId],
  );
  if (!result.rows[0]) throw new NotFoundError("Perfil não encontrado.");

  const streak = await computeStreak(otherId, todayIso());
  const weekStart = sundayWeekStartIso(todayIso());
  const minutesMap = await getWeeklyFocusMinutesForProfiles([otherId], weekStart);
  const achievements = await listAchievementProgress(otherId);
  const friendIds = isOwner ? [] : [viewerId];
  const isFriend = isOwner ? undefined : true;

  const row = result.rows[0];
  const featured = achievements
    .filter((item) => item.isFeatured && item.unlockedTier > 0)
    .sort((a, b) => (a.featuredOrder ?? 99) - (b.featuredOrder ?? 99));

  return {
    id: row.id,
    displayName: row.display_name,
    username: row.username ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    role: (row.role as "user" | "admin" | null) ?? "user",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    lastActiveAt: row.last_active_at ? new Date(row.last_active_at).toISOString() : undefined,
    currentStreak: streak.currentStreak,
    longestStreak: Math.max(streak.longestStreak, row.longest_streak ?? 0),
    weeklyFocusMinutes: minutesMap.get(otherId) ?? 0,
    equippedDecorationId: row.equipped_decoration_id ?? undefined,
    hasCustomBanner: row.has_custom_banner ?? false,
    bannerImageUrl: row.banner_image_url ?? undefined,
    achievements,
    featuredAchievements: featured,
    isFriend,
    isOwner,
  };
}

export async function getUnreadCounts(profileId: string): Promise<{
  hasUnread: boolean;
  dmUnread: number;
  groupUnread: number;
}> {
  parseProfileId(profileId);
  const [dms, groups] = await Promise.all([
    pool.query<{ count: string | number }>(
      `select count(*)::int as count from direct_messages dm
       where dm.recipient_id = $1
         and dm.created_at > coalesce(
           (select read_at from dm_reads r where r.profile_id = $1 and r.other_id = dm.sender_id),
           'epoch'::timestamptz
         )`,
      [profileId],
    ),
    pool.query<{ count: string | number }>(
      `select count(*)::int as count from group_messages gm
       join group_members m on m.group_id = gm.group_id and m.profile_id = $1
       where gm.sender_id <> $1
         and gm.created_at > coalesce(
           (select read_at from group_reads r where r.profile_id = $1 and r.group_id = gm.group_id),
           'epoch'::timestamptz
         )`,
      [profileId],
    ),
  ]);
  const dmUnread = Number(dms.rows[0]?.count ?? 0);
  const groupUnread = Number(groups.rows[0]?.count ?? 0);
  return { hasUnread: dmUnread + groupUnread > 0, dmUnread, groupUnread };
}

export async function acceptedFriendIds(profileId: string): Promise<string[]> {
  const result = await pool.query<{ id: string }>(
    `select case when requester_id = $1 then addressee_id else requester_id end as id
     from friendships where status = 'accepted' and (requester_id = $1 or addressee_id = $1)`,
    [profileId],
  );
  return result.rows.map((row) => row.id);
}

export function parseOptionalQuery(value: unknown, field: string): string {
  if (typeof value !== "string") throw new ValidationError(`${field} é obrigatório.`);
  return parseTitle(value, field);
}
