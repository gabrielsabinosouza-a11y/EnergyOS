import pool from "../db";
import { addCoins } from "./settings";
import { parseProfileId } from "./validation";
import { NotFoundError } from "../errors";
import { todayIso, weekStartIso, addDaysIso } from "./dates";
import { getGroupRoomPresenceCounts } from "./group-room-presence";
import { GROUP_ACHIEVEMENTS, type GroupAchievementId, type GroupAchievementUnlock } from "./group-achievement-config";

// ─── Achievement definitions ──────────────────────────────────────────────────

export const GROUP_ACHIEVEMENT_IDS = Object.values(GROUP_ACHIEVEMENTS).map((achievement) => achievement.id);

export interface GroupAchievementStatus {
  id: GroupAchievementId;
  title: string;
  description: string;
  requirement: string;
  coinsPerMember: number;
  unlockedAt: string | null;
  progressLabel: string;
}

function assertGroupId(groupId: number): void {
  if (!Number.isInteger(groupId) || groupId <= 0) {
    throw new NotFoundError("Grupo inválido.");
  }
}

// ─── Schema migration (idempotent) ────────────────────────────────────────────
// `group_achievements.id` was originally constrained to 'sincronia' only; widen
// it in place so existing databases accept the three new achievement ids.
let schemaEnsured = false;
async function ensureGroupAchievementsSchema(): Promise<void> {
  if (schemaEnsured) return;
  await pool.query(`
    do $$ begin
      alter table group_achievements drop constraint if exists group_achievements_id_check;
    exception when undefined_object then null;
    end $$`);
  await pool.query(`
    do $$ begin
      alter table group_achievements add constraint group_achievements_id_check
        check (id in ('sincronia', 'esquadrao_completo', 'maratona_coletiva', 'consistencia_de_equipe'));
    exception when duplicate_object then null;
    end $$`);
  schemaEnsured = true;
}

// ─── Condition checks ─────────────────────────────────────────────────────────

async function findFullSquadOverlap(groupId: number): Promise<boolean> {
  const rooms = await getGroupRoomPresenceCounts(groupId);
  return rooms.some((room) =>
    room.activeMemberCount >= GROUP_ACHIEVEMENTS.esquadrao_completo.minimumMembers &&
    room.activePresentCount === room.activeMemberCount,
  );
}

async function findMarathonWeek(groupId: number): Promise<boolean> {
  const result = await pool.query(
    `select 1
     from group_focus_contributions
     where group_id = $1
     group by date_trunc('week', contributed_at at time zone 'America/Sao_Paulo')
     having sum(minutes) >= $2
     limit 1`,
    [groupId, GROUP_ACHIEVEMENTS.maratona_coletiva.targetMinutes],
  );
  return (result.rowCount ?? 0) > 0;
}

async function findConsistencyStreak(groupId: number): Promise<boolean> {
  const result = await pool.query(
    `with member_days as (
       select distinct (contributed_at at time zone 'America/Sao_Paulo')::date as day, profile_id
       from group_focus_contributions
       where group_id = $1 and minutes >= 1
     ), team_days as (
       select day, count(distinct profile_id) as active_members
       from member_days
       group by day
       having count(distinct profile_id) >= $2
     ), runs as (
       select day, day - (row_number() over (order by day))::int as run
       from team_days
     )
     select 1 from runs group by run having count(*) >= $3 limit 1`,
    [groupId, GROUP_ACHIEVEMENTS.consistencia_de_equipe.minimumMembers, GROUP_ACHIEVEMENTS.consistencia_de_equipe.consecutiveDays],
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Unlock + reward (idempotent) ────────────────────────────────────────────

/**
 * Unlock an achievement for the group and, only when it was just unlocked,
 * mint the reward to every current non-banned member exactly once (the unique
 * claims constraint plus `on conflict do nothing` guards against replay).
 */
export async function unlockAndCredit(
  groupId: number,
  achievementId: GroupAchievementId,
): Promise<GroupAchievementUnlock | null> {
  const definition = Object.values(GROUP_ACHIEVEMENTS).find((achievement) => achievement.id === achievementId);
  if (!definition) throw new Error(`Unknown group achievement: ${achievementId}`);

  const client = await pool.connect();
  try {
    await client.query("begin");
    const unlocked = await client.query<{ unlocked_at: string }>(
      `insert into group_achievements (id, group_id) values ($1, $2)
       on conflict (id, group_id) do nothing
       returning unlocked_at::text`,
      [achievementId, groupId],
    );
    if (!unlocked.rows[0]) {
      await client.query("commit");
      return null;
    }

    const members = await client.query<{ profile_id: string }>(
      `select profile_id from group_members where group_id = $1 and is_banned = false`,
      [groupId],
    );
    for (const { profile_id } of members.rows) {
      const inserted = await client.query(
        `insert into group_achievement_claims (achievement_id, group_id, profile_id, coins_awarded)
         values ($1, $2, $3, $4)
         on conflict (achievement_id, group_id, profile_id) do nothing
         returning id`,
        [achievementId, groupId, profile_id, definition.coinsPerMember],
      );
      if (inserted.rows[0]) await addCoins(profile_id, definition.coinsPerMember, client);
    }

    await client.query("commit");
    return { id: achievementId, title: definition.title, groupId, unlockedAt: unlocked.rows[0].unlocked_at };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check the three runtime group achievements after any completed focus session.
 * "Sincronia" is still handled by `checkGroupSynchrony`.
 */
export async function checkGroupAchievements(groupId: number): Promise<GroupAchievementUnlock[]> {
  assertGroupId(groupId);
  await ensureGroupAchievementsSchema();

  const unlocked: GroupAchievementUnlock[] = [];
  if (await findFullSquadOverlap(groupId)) {
    const item = await unlockAndCredit(groupId, GROUP_ACHIEVEMENTS.esquadrao_completo.id);
    if (item) unlocked.push(item);
  }
  if (await findMarathonWeek(groupId)) {
    const item = await unlockAndCredit(groupId, GROUP_ACHIEVEMENTS.maratona_coletiva.id);
    if (item) unlocked.push(item);
  }
  if (await findConsistencyStreak(groupId)) {
    const item = await unlockAndCredit(groupId, GROUP_ACHIEVEMENTS.consistencia_de_equipe.id);
    if (item) unlocked.push(item);
  }
  return unlocked;
}

/**
 * Status of every group achievement for the group, from the calling member's
 * perspective. Unlocks anything whose condition is already met.
 */
export async function getGroupAchievementsStatus(
  profileId: string,
  groupId: number,
): Promise<GroupAchievementStatus[]> {
  parseProfileId(profileId);
  assertGroupId(groupId);
  await ensureGroupAchievementsSchema();

  const rows = await pool.query<{ id: string; unlocked_at: string }>(
    `select id, unlocked_at::text from group_achievements where group_id = $1`,
    [groupId],
  );
  const unlockedAt = new Map(rows.rows.map((r) => [r.id, r.unlocked_at]));
  const weekStart = weekStartIso(todayIso());
  const weekEnd = addDaysIso(weekStart, 7);
  const [presence, marathon, consistency] = await Promise.all([
    getGroupRoomPresenceCounts(groupId),
    pool.query<{ minutes: string | number }>(
      `select coalesce(sum(minutes), 0)::int as minutes
       from group_focus_contributions
       where group_id = $1
         and contributed_at >= ($2::date)::timestamp at time zone 'America/Sao_Paulo'
         and contributed_at < ($3::date)::timestamp at time zone 'America/Sao_Paulo'`,
      [groupId, weekStart, weekEnd],
    ),
    pool.query<{ day: string }>(
      `select (contributed_at at time zone 'America/Sao_Paulo')::date::text as day
       from group_focus_contributions
       where group_id = $1
         and contributed_at >= ((now() at time zone 'America/Sao_Paulo')::date - 6)::timestamp at time zone 'America/Sao_Paulo'
       group by day
       having count(distinct profile_id) >= $2
       order by day desc
       limit $3`,
      [groupId, GROUP_ACHIEVEMENTS.consistencia_de_equipe.minimumMembers, GROUP_ACHIEVEMENTS.consistencia_de_equipe.consecutiveDays],
    ),
  ]);
  const maxPresent = Math.max(0, ...presence.map((room) => room.memberCount));
  const fullSquad = presence.find((room) =>
    room.activeMemberCount >= GROUP_ACHIEVEMENTS.esquadrao_completo.minimumMembers &&
    room.activePresentCount === room.activeMemberCount,
  );
  const teamDays = new Set(consistency.rows.map((row) => row.day));
  let consistentDays = 0;
  let cursor = todayIso();
  if (!teamDays.has(cursor)) cursor = addDaysIso(cursor, -1);
  while (
    consistentDays < GROUP_ACHIEVEMENTS.consistencia_de_equipe.consecutiveDays &&
    teamDays.has(cursor)
  ) {
    consistentDays += 1;
    cursor = addDaysIso(cursor, -1);
  }
  const weeklyMinutes = Number(marathon.rows[0]?.minutes ?? 0);

  return GROUP_ACHIEVEMENT_IDS.map((id) => {
    const def = Object.values(GROUP_ACHIEVEMENTS).find((achievement) => achievement.id === id);
    if (!def) throw new Error(`Missing group achievement configuration: ${id}`);
    const progressLabel = id === GROUP_ACHIEVEMENTS.sincronia.id
      ? `${Math.min(maxPresent, GROUP_ACHIEVEMENTS.sincronia.targetMembers)}/${GROUP_ACHIEVEMENTS.sincronia.targetMembers} membros agora`
      : id === GROUP_ACHIEVEMENTS.esquadrao_completo.id
        ? `${fullSquad?.activePresentCount ?? 0}/${fullSquad?.activeMemberCount ?? 0} membros ativos agora`
        : id === GROUP_ACHIEVEMENTS.maratona_coletiva.id
          ? `${Math.min(weeklyMinutes, GROUP_ACHIEVEMENTS.maratona_coletiva.targetMinutes)}/${GROUP_ACHIEVEMENTS.maratona_coletiva.targetMinutes} min esta semana`
          : `${Math.min(consistentDays, GROUP_ACHIEVEMENTS.consistencia_de_equipe.consecutiveDays)}/${GROUP_ACHIEVEMENTS.consistencia_de_equipe.consecutiveDays} dias`;
    return {
      id,
      title: def.title,
      description: def.description,
      requirement: def.requirement,
      coinsPerMember: def.coinsPerMember,
      unlockedAt: unlockedAt.get(id) ?? null,
      progressLabel,
    };
  });
}