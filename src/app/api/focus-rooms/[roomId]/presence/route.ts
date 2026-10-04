import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { badRequest, handleRoute, jsonOk } from "@/lib/http";
import { heartbeatGroupRoomPresence } from "@/lib/db/group-room-presence";
import { checkGroupAchievements } from "@/lib/db/group-achievements";
import { checkGroupSynchrony } from "@/lib/db/group-synchrony";
import type { GroupAchievementUnlock } from "@/lib/db/group-achievement-config";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const roomId = Number((await params).roomId);
    if (!Number.isInteger(roomId) || roomId <= 0) {
      return badRequest("Sala inválida.");
    }

    const groupIds = await heartbeatGroupRoomPresence(roomId, profileId);
    const unlocked: GroupAchievementUnlock[] = [];
    for (const groupId of groupIds) {
      const [groupAchievements, synchrony] = await Promise.all([
        checkGroupAchievements(groupId),
        checkGroupSynchrony(groupId),
      ]);
      unlocked.push(...groupAchievements);
      if (synchrony) unlocked.push(synchrony);
    }
    return jsonOk({ unlockedGroupAchievements: unlocked });
  });
}
