import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { todayIso } from "@/lib/db/dates";
import { incrementQuestProgress, initializeUserDailyQuests, getUserQuestProgress } from "@/lib/db/daily-quests";
import type { QuestType } from "@/types";

/**
 * This endpoint is called when a focus session completes to update relevant quests.
 * It handles:
 * - SESSIONS_COUNT: +1 for each completed session
 * - TOTAL_MINUTES: += session duration in minutes
 * - ROOM_SESSION: +1 if session was in a focus room
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const body = await readJsonBody(request);
    const today = todayIso();
    
    // Ensure today's quests are initialized
    await initializeUserDailyQuests(profileId, today);
    
    // Get current progress for all quests today
    const progress = await getUserQuestProgress(profileId, today);
    
    const updated: Array<{ questId: number; type: QuestType; newValue: number }> = [];
    
    // SECURITY: quest progress is derived from server-side session data only.
    // The previous client-driven path (questId + arbitrary amount) let any
    // authenticated user instantly complete quests and claim coin rewards.
    // Session data is clamped to the same server-side caps used by
    // endFocusSession (target duration ≤ 240 min).
    const questType = typeof body.questType === "string" ? body.questType : undefined;

    if (questType) {
      throw new ValidationError("Atualizações diretas de missão foram descontinuadas. O progresso é calculado pelo servidor.");
    }
    
    // Auto-update based on session completion
    const session = (body.sessionData ?? null) as { durationMinutes?: unknown; isRoomSession?: unknown } | null;
    
    if (session) {
      const durationMinutes = Math.max(
        0,
        Math.min(
          Number(session.durationMinutes) || 0,
          240,
        ),
      );
      const isRoomSession = session.isRoomSession === true;
      
      for (const p of progress) {
        // Update SESSIONS_COUNT quest
        if (p.questId === 1) { // Complete 2 sessions today
          const result = await incrementQuestProgress(profileId, p.questId, today, 1);
          updated.push({ questId: p.questId, type: "SESSIONS_COUNT", newValue: result.currentValue });
        }
        
        // Update TOTAL_MINUTES quest
        if (p.questId === 2 && durationMinutes > 0) { // Focus 90 minutes
          const result = await incrementQuestProgress(profileId, p.questId, today, durationMinutes);
          updated.push({ questId: p.questId, type: "TOTAL_MINUTES", newValue: result.currentValue });
        }
        
        // Update ROOM_SESSION quest
        if (p.questId === 3 && isRoomSession) { // Focus in room
          const result = await incrementQuestProgress(profileId, p.questId, today, 1);
          updated.push({ questId: p.questId, type: "ROOM_SESSION", newValue: result.currentValue });
        }
      }
    }
    
    // Refresh progress to return updated state
    const refreshedProgress = await getUserQuestProgress(profileId, today);
    
    return jsonOk({ 
      progress: refreshedProgress,
      date: today,
    });
  });
}
