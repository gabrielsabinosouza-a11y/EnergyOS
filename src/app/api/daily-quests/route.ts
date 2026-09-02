import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import {
  getUserQuestProgressWithQuests,
  initializeUserDailyQuests,
} from "@/lib/db/daily-quests";
import { dailyResetAtIso, todayIso } from "@/lib/db/dates";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const today = todayIso();
    
    // Ensure quests exist and get user's progress
    await initializeUserDailyQuests(profileId, today);
    const quests = await getUserQuestProgressWithQuests(profileId, today);
    
    return jsonOk({ quests, date: today, resetAt: dailyResetAtIso() });
  });
}
