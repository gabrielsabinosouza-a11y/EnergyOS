import pool from "../db";
import { parseProfileId } from "./validation";
import { GROUP_ACHIEVEMENTS } from "./group-achievement-config";

export interface GroupRoomPresenceCount {
  roomId: number;
  memberCount: number;
  activeMemberCount: number;
  activePresentCount: number;
}

let schemaReady: Promise<void> | null = null;

export function ensureGroupRoomPresenceSchema(): Promise<void> {
  schemaReady ??= pool.query(`
    create table if not exists group_focus_room_presence (
      group_id bigint not null references groups(id) on delete cascade,
      room_id bigint not null references focus_rooms(id) on delete cascade,
      profile_id text not null references profiles(id) on delete cascade,
      started_at timestamptz not null default now(),
      last_heartbeat timestamptz not null default now(),
      primary key (group_id, room_id, profile_id)
    )
  `).then(async () => {
    await pool.query(`
      create index if not exists group_focus_room_presence_fresh_idx
      on group_focus_room_presence(group_id, room_id, last_heartbeat)
    `);
  }).catch((error: unknown) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

export async function heartbeatGroupRoomPresence(roomId: number, profileId: string): Promise<number[]> {
  parseProfileId(profileId);
  await ensureGroupRoomPresenceSchema();
  await pool.query(
    `delete from group_focus_room_presence where last_heartbeat < now() - interval '2 minutes'`,
  );
  const result = await pool.query<{ group_id: string | number }>(
    `insert into group_focus_room_presence (group_id, room_id, profile_id)
     select gm.group_id, r.id, rp.profile_id
     from focus_rooms r
     join room_participants rp on rp.room_id = r.id and rp.profile_id = $2
     join group_members gm on gm.profile_id = rp.profile_id and gm.is_banned = false
     where r.id = $1 and r.status = 'active' and rp.session_status = 'focusing'
     on conflict (group_id, room_id, profile_id)
     do update set last_heartbeat = now()
     returning group_id`,
    [roomId, profileId],
  );
  return result.rows.map((row) => Number(row.group_id));
}

export async function clearGroupRoomPresence(roomId: number, profileId: string): Promise<void> {
  parseProfileId(profileId);
  await ensureGroupRoomPresenceSchema();
  await pool.query(
    `delete from group_focus_room_presence where room_id = $1 and profile_id = $2`,
    [roomId, profileId],
  );
}

export async function clearAllGroupRoomPresence(roomId: number): Promise<void> {
  await ensureGroupRoomPresenceSchema();
  await pool.query(`delete from group_focus_room_presence where room_id = $1`, [roomId]);
}

export async function getGroupRoomPresenceCounts(groupId: number): Promise<GroupRoomPresenceCount[]> {
  await ensureGroupRoomPresenceSchema();
  const result = await pool.query<{
    room_id: string | number;
    member_count: string | number;
    active_member_count: string | number;
    active_present_count: string | number;
  }>(
    `select presence.room_id,
            count(distinct presence.profile_id)::int as member_count,
            (select count(*)::int from group_members
             where group_id = $1 and is_banned = false
               and exists (
                 select 1 from group_focus_contributions contribution
                 where contribution.group_id = $1
                   and contribution.profile_id = group_members.profile_id
                   and contribution.contributed_at >=
                     ((now() at time zone 'America/Sao_Paulo')::date - $2)::timestamp
                       at time zone 'America/Sao_Paulo'
               )) as active_member_count,
            count(distinct presence.profile_id) filter (where exists (
              select 1 from group_focus_contributions contribution
              where contribution.group_id = $1
                and contribution.profile_id = presence.profile_id
                and contribution.contributed_at >=
                  ((now() at time zone 'America/Sao_Paulo')::date - $2)::timestamp
                    at time zone 'America/Sao_Paulo'
            ))::int as active_present_count
     from group_focus_room_presence presence
     join focus_rooms room on room.id = presence.room_id and room.status = 'active'
     join room_participants participant
       on participant.room_id = presence.room_id
      and participant.profile_id = presence.profile_id
      and participant.session_status = 'focusing'
     join group_members member
       on member.group_id = presence.group_id
      and member.profile_id = presence.profile_id
      and member.is_banned = false
     where presence.group_id = $1
       and presence.last_heartbeat >= now() - interval '2 minutes'
     group by presence.room_id`,
    [groupId, GROUP_ACHIEVEMENTS.esquadrao_completo.activeDays - 1],
  );
  return result.rows.map((row) => ({
    roomId: Number(row.room_id),
    memberCount: Number(row.member_count),
    activeMemberCount: Number(row.active_member_count),
    activePresentCount: Number(row.active_present_count),
  }));
}
