import pool from "../db";
import { addCoins } from "./settings";
import { parseProfileId } from "./validation";
import { NotFoundError } from "../errors";

/**
 * Group achievement "Sincronia": unlocked when at least `SYNCHRONY_MIN_MEMBERS`
 * distinct members of the same group were focusing simultaneously in the same
 * focus room (overlapping participant windows on the same `focus_rooms`).
 */
export const SYNCHRONY_ID = "sincronia";
export const SYNCHRONY_MIN_MEMBERS = 2;
export const SYNCHRONY_COINS_PER_MEMBER = 100;

export const GROUP_ACHIEVEMENT_DEFS: Record<string, { title: string; description: string; requirement: string }> = {
  [SYNCHRONY_ID]: {
    title: "Sincronia",
    description: "Membros focando juntos na mesma sala de foco",
    requirement: `${SYNCHRONY_MIN_MEMBERS}+ membros focando na mesma sala ao mesmo tempo`,
  },
};

export interface GroupSynchronyStatus {
  id: string;
  title: string;
  description: string;
  requirement: string;
  minMembers: number;
  coinsPerMember: number;
  unlockedAt: string | null;
}

function assertGroupId(groupId: number): void {
  if (!Number.isInteger(groupId) || groupId <= 0) {
    throw new NotFoundError("Grupo inválido.");
  }
}

/**
 * Whether any two distinct, non-banned members of the group ever shared an
 * overlapping stay in the same focus room — i.e. focused simultaneously.
 * A participant's stay window is [joined_at, completed_at | gave_up_at | now()].
 */
async function findSynchronyPair(groupId: number): Promise<boolean> {
  const result = await pool.query(
    `select 1
     from room_participants rp1
     join room_participants rp2
       on rp2.room_id = rp1.room_id and rp2.profile_id <> rp1.profile_id
     join group_members gm1
       on gm1.profile_id = rp1.profile_id and gm1.group_id = $1 and gm1.is_banned = false
     join group_members gm2
       on gm2.profile_id = rp2.profile_id and gm2.group_id = $1 and gm2.is_banned = false
     where rp1.session_status in ('focusing', 'completed')
       and rp2.session_status in ('focusing', 'completed')
       and rp1.joined_at < coalesce(rp2.completed_at, rp2.gave_up_at, now())
       and rp2.joined_at < coalesce(rp1.completed_at, rp1.gave_up_at, now())
     limit 1`,
    [groupId],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Mint the coin reward to every current non-banned member. Idempotent: the
 * claims unique constraint plus `on conflict do nothing` guarantees each member
 * is rewarded exactly once.
 */
async function creditSynchronyRewards(groupId: number): Promise<void> {
  const members = await pool.query<{ profile_id: string }>(
    `select profile_id from group_members where group_id = $1 and is_banned = false`,
    [groupId],
  );
  for (const { profile_id } of members.rows) {
    const inserted = await pool.query(
      `insert into group_achievement_claims (achievement_id, group_id, profile_id, coins_awarded)
       values ($1, $2, $3, $4)
       on conflict (achievement_id, group_id, profile_id) do nothing
       returning id`,
      [SYNCHRONY_ID, groupId, profile_id, SYNCHRONY_COINS_PER_MEMBER],
    );
    if (inserted.rows[0]) await addCoins(profile_id, SYNCHRONY_COINS_PER_MEMBER);
  }
}

/**
 * After any focus session, call this to unlock "Sincronia" for the group when
 * two members ever focused simultaneously in the same room, auto-awarding coins
 * to every member exactly once.
 */
export async function checkGroupSynchrony(groupId: number): Promise<void> {
  assertGroupId(groupId);
  if (!(await findSynchronyPair(groupId))) return;

  const unlocked = await pool.query<{ unlocked_at: string }>(
    `insert into group_achievements (id, group_id) values ($1, $2)
     on conflict (id, group_id) do nothing
     returning unlocked_at::text`,
    [SYNCHRONY_ID, groupId],
  );
  if (!unlocked.rows[0]) return; // already unlocked — rewards already minted

  await creditSynchronyRewards(groupId);
}

export async function getGroupSynchronyStatus(
  profileId: string,
  groupId: number,
): Promise<GroupSynchronyStatus> {
  parseProfileId(profileId);
  assertGroupId(groupId);

  const row = await pool.query<{ unlocked_at: string }>(
    `select unlocked_at::text from group_achievements
     where id = $1 and group_id = $2`,
    [SYNCHRONY_ID, groupId],
  );

  const def = GROUP_ACHIEVEMENT_DEFS[SYNCHRONY_ID];
  return {
    id: SYNCHRONY_ID,
    title: def.title,
    description: def.description,
    requirement: def.requirement,
    minMembers: SYNCHRONY_MIN_MEMBERS,
    coinsPerMember: SYNCHRONY_COINS_PER_MEMBER,
    unlockedAt: row.rows[0]?.unlocked_at ?? null,
  };
}
