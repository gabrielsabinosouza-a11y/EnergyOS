import { NotFoundError } from "../errors";
import { getGroupRoomPresenceCounts } from "./group-room-presence";
import { GROUP_ACHIEVEMENTS } from "./group-achievement-config";
import { unlockAndCredit } from "./group-achievements";
import type { GroupAchievementUnlock } from "./group-achievement-config";

export const SYNCHRONY_ID = GROUP_ACHIEVEMENTS.sincronia.id;
export const SYNCHRONY_MIN_MEMBERS = GROUP_ACHIEVEMENTS.sincronia.targetMembers;
export const SYNCHRONY_COINS_PER_MEMBER = GROUP_ACHIEVEMENTS.sincronia.coinsPerMember;
export const GROUP_ACHIEVEMENT_DEFS = {
  [SYNCHRONY_ID]: {
    title: GROUP_ACHIEVEMENTS.sincronia.title,
    description: GROUP_ACHIEVEMENTS.sincronia.description,
    requirement: GROUP_ACHIEVEMENTS.sincronia.requirement,
  },
};

function assertGroupId(groupId: number): void {
  if (!Number.isInteger(groupId) || groupId <= 0) throw new NotFoundError("Grupo inválido.");
}

/** Unlock when two group members have fresh presence in the same live room. */
export async function checkGroupSynchrony(groupId: number): Promise<GroupAchievementUnlock | null> {
  assertGroupId(groupId);
  const rooms = await getGroupRoomPresenceCounts(groupId);
  if (!rooms.some((room) => room.memberCount >= GROUP_ACHIEVEMENTS.sincronia.targetMembers)) return null;
  return unlockAndCredit(groupId, GROUP_ACHIEVEMENTS.sincronia.id);
}
