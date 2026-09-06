import pool from "../db";
import { addCoins } from "./settings";
import { parseProfileId } from "./validation";
import { NotFoundError } from "../errors";
import {
  SYNCHRONY_ID,
  SYNCHRONY_COINS_PER_MEMBER,
  GROUP_ACHIEVEMENT_DEFS as SYNCHRONY_DEFS,
} from "./group-synchrony";

// ─── Achievement definitions ──────────────────────────────────────────────────

export const SQUAD_ID = "esquadrao_completo";
export const MARATHON_ID = "maratona_coletiva";
export const CONSISTENCY_ID = "consistencia_de_equipe";

export const SQUAD_COINS_PER_MEMBER = 150;
export const SQUAD_MIN_MEMBERS = 2;
export const MARATHON_WEEK_MINUTES = 2000;
export const MARATHON_COINS_PER_MEMBER = 200;
export const CONSISTENCY_MIN_MEMBERS = 2;
export const CONSISTENCY_CONSECUTIVE_DAYS = 5;
export const CONSISTENCY_COINS_PER_MEMBER = 150;

const GROUP_ACHIEVEMENT_COINS: Record<string, number> = {
  [SYNCHRONY_ID]: SYNCHRONY_COINS_PER_MEMBER,
  [SQUAD_ID]: SQUAD_COINS_PER_MEMBER,
  [MARATHON_ID]: MARATHON_COINS_PER_MEMBER,
  [CONSISTENCY_ID]: CONSISTENCY_COINS_PER_MEMBER,
};

export const GROUP_ACHIEVEMENT_DEFS: Record<string, { title: string; description: string; requirement: string }> = {
  ...SYNCHRONY_DEFS,
  [SQUAD_ID]: {
    title: "Esquadrão Completo",
    description: "Todos os membros ativos focando juntos na mesma sala de foco",
    requirement: `${SQUAD_MIN_MEMBERS}+ membros focando na mesma sala ao mesmo tempo, incluindo todos os ativos`,
  },
  [MARATHON_ID]: {
    title: "Maratona Coletiva",
    description: "Muitos minutos combinados de foco em uma única semana",
    requirement: `${MARATHON_WEEK_MINUTES.toLocaleString("pt-BR")}+ min combinados na mesma semana`,
  },
  [CONSISTENCY_ID]: {
    title: "Consistência de Equipe",
    description: "A equipe focando junto por vários dias seguidos",
    requirement: `${CONSISTENCY_MIN_MEMBERS}+ membros focando por ${CONSISTENCY_CONSECUTIVE_DAYS} dias seguidos`,
  },
};

export const GROUP_ACHIEVEMENT_IDS = [SYNCHRONY_ID, SQUAD_ID, MARATHON_ID, CONSISTENCY_ID];

export interface GroupAchievementStatus {
  id: string;
  title: string;
  description: string;
  requirement: string;
  coinsPerMember: number;
  unlockedAt: string | null;
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

/**
 * "Esquadrão Completo": every active (non-banned) member of the group ever
 * shared a common instant inside the same focus room. A common intersection of
 * stay windows [joined_at, completed_at | gave_up_at | now()] exists iff the
 * latest join happened before the earliest departure.
 */
async function findFullSquadOverlap(groupId: number): Promise<boolean> {
  const result = await pool.query(
    `select 1
     from focus_rooms r
     join room_participants rp
       on rp.room_id = r.id
     join group_members gm
       on gm.group_id = $1 and gm.profile_id = rp.profile_id and gm.is_banned = false
     where rp.session_status in ('focusing', 'completed')
     group by r.id
     having max(rp.joined_at) < min(coalesce(rp.completed_at, rp.gave_up_at, now()))
        and count(distinct rp.profile_id) =
            (select count(*) from group_members where group_id = $1 and is_banned = false)
        and count(distinct rp.profile_id) >= $2
     limit 1`,
    [groupId, SQUAD_MIN_MEMBERS],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * "Maratona Coletiva": the group ever summed at least `MARATHON_WEEK_MINUTES`
 * combined focused minutes within a single calendar week (Monday start, local).
 */
async function findMarathonWeek(groupId: number): Promise<boolean> {
  const result = await pool.query(
    `select 1
     from group_focus_contributions
     where group_id = $1
     group by date_trunc('week', contributed_at at time zone 'America/Sao_Paulo')
     having sum(minutes) >= $2
     limit 1`,
    [groupId, MARATHON_WEEK_MINUTES],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * "Consistência de Equipe": on at least `CONSISTENCY_CONSECUTIVE_DAYS`
 * consecutive days, at least `CONSISTENCY_MIN_MEMBERS` distinct members each
 * logged at least one focused minute.
 */
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
    [groupId, CONSISTENCY_MIN_MEMBERS, CONSISTENCY_CONSECUTIVE_DAYS],
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Unlock + reward (idempotent) ────────────────────────────────────────────

/**
 * Unlock an achievement for the group and, only when it was just unlocked,
 * mint the reward to every current non-banned member exactly once (the unique
 * claims constraint plus `on conflict do nothing` guards against replay).
 */
async function unlockAndCredit(groupId: number, achievementId: string, coinsPerMember: number): Promise<void> {
  const unlocked = await pool.query<{ unlocked_at: string }>(
    `insert into group_achievements (id, group_id) values ($1, $2)
     on conflict (id, group_id) do nothing
     returning unlocked_at::text`,
    [achievementId, groupId],
  );
  if (!unlocked.rows[0]) return; // already unlocked — rewards already minted

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
      [achievementId, groupId, profile_id, coinsPerMember],
    );
    if (inserted.rows[0]) await addCoins(profile_id, coinsPerMember);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check the three runtime group achievements after any completed focus session.
 * "Sincronia" is still handled by `checkGroupSynchrony`.
 */
export async function checkGroupAchievements(groupId: number): Promise<void> {
  assertGroupId(groupId);
  await ensureGroupAchievementsSchema();

  if (await findFullSquadOverlap(groupId)) {
    await unlockAndCredit(groupId, SQUAD_ID, SQUAD_COINS_PER_MEMBER);
  }
  if (await findMarathonWeek(groupId)) {
    await unlockAndCredit(groupId, MARATHON_ID, MARATHON_COINS_PER_MEMBER);
  }
  if (await findConsistencyStreak(groupId)) {
    await unlockAndCredit(groupId, CONSISTENCY_ID, CONSISTENCY_COINS_PER_MEMBER);
  }
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

  return GROUP_ACHIEVEMENT_IDS.map((id) => {
    const def = GROUP_ACHIEVEMENT_DEFS[id];
    return {
      id,
      title: def.title,
      description: def.description,
      requirement: def.requirement,
      coinsPerMember: GROUP_ACHIEVEMENT_COINS[id],
      unlockedAt: unlockedAt.get(id) ?? null,
    };
  });
}