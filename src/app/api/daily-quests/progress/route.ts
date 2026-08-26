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
    
    // Update relevant quests based on session data
    const updated: Array<{ questId: number; type: QuestType; newValue: number }> = [];
    
    for (const p of progress) {
      const questType = body.questType as QuestType | undefined;
      
      // If this is a specific quest type update from the client
      if (questType) {
        // This path is for targeted updates
        if (p.questId === body.questId) {
          const result = await incrementQuestProgress(
            profileId,
            p.questId,
            today,
            body.amount ?? 1
          );
          updated.push({
            questId: p.questId,
            type: questType,
            newValue: result.currentValue,
          });
        }
      } else {
        // Auto-update based on session completion
        // This requires the client to send session data
        if (body.sessionData) {
          const session = body.sessionData;
          
          // Update SESSIONS_COUNT quest
          if (p.questId === 1) { // Complete 2 sessions today
            await incrementQuestProgress(profileId, p.questId, today, 1);
          }
          
          // Update TOTAL_MINUTES quest
          if (p.questId === 2 && session.durationMinutes) { // Focus 90 minutes
            await incrementQuestProgress(profileId, p.questId, today, session.durationMinutes);
          }
          
          // Update ROOM_SESSION quest
          if (p.questId === 3 && session.isRoomSession) { // Focus in room
            await incrementQuestProgress(profileId, p.questId, today, 1);
          }
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
