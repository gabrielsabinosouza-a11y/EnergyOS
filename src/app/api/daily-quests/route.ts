import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import {
  listDailyQuests,
  getUserQuestProgressWithQuests,
  initializeUserDailyQuests,
  claimQuestReward,
} from "@/lib/db/daily-quests";
import { todayIso } from "@/lib/db/dates";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const today = todayIso();
    
    // Ensure quests exist and get user's progress
    await initializeUserDailyQuests(profileId, today);
    const quests = await getUserQuestProgressWithQuests(profileId, today);
    
    return jsonOk({ quests, date: today });
  });
}
