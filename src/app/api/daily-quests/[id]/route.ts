import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import { claimQuestReward } from "@/lib/db/daily-quests";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const questProgressId = Number(id);
    
    const result = await claimQuestReward(profileId, questProgressId);
    
    return jsonOk({
      coinsAwarded: result.coinsAwarded,
      xpAwarded: result.xpAwarded,
      baseXp: result.baseXp,
      quest: result.quest,
      message: `+${result.coinsAwarded} moedas!`,
    });
  });
}
