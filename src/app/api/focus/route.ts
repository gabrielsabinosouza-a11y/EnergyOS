import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { rateLimitForProfile } from "@/lib/rate-limit";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import {
  cancelFocusSession,
  endFocusSession,
  expireAwayFocusSessions,
  getFocusHistory,
  getLifetimeFocusMinutes,
  getTodayFocusStats,
  startFocusSession,
  registerFocusAppState,
  updateFocusSessionPause,
} from "@/lib/db/focus";
import { getUserXP } from "@/lib/db/xp";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await expireAwayFocusSessions(profileId);
    const [history, todayStats, xp, lifetimeFocusMinutes] = await Promise.all([
      getFocusHistory(profileId),
      getTodayFocusStats(profileId),
      getUserXP(profileId),
      getLifetimeFocusMinutes(profileId),
    ]);
    return jsonOk({ history, todayStats, xp, lifetimeFocusMinutes });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    rateLimitForProfile(profileId, "focus-post", 30, 60_000);
    const body = await readJsonBody(request);
    const action = body.action as string;

    if (action === "start") {
      const targetDurationMinutes = Number(body.targetDurationMinutes) || 25;
      const energyType = body.energyType as string | undefined;
      const roomId = body.roomId === undefined ? undefined : Number(body.roomId);
      const session = await startFocusSession(profileId, targetDurationMinutes, body.taskId as number | undefined, energyType, roomId);
      return jsonOk({ session }, 201);
    }

    if (action === "cancel") {
      await cancelFocusSession(profileId, Number(body.sessionId));
      return jsonOk({ cancelled: true });
    }

    if (action === "pause" || action === "resume") {
      await updateFocusSessionPause(profileId, Number(body.sessionId), action);
      return jsonOk({ paused: action === "pause" });
    }

    if (action === "app_state" && (body.state === "away" || body.state === "return")) {
      const gaveUp = await registerFocusAppState(profileId, Number(body.sessionId), body.state);
      return jsonOk({ gaveUp });
    }

    if (action === "complete" || action === "give_up" || action === "end") {
      const focusedSeconds = Number(body.focusedSeconds) || 0;
      const isRoomSession = body.isRoomSession === true;
      const pausedCount = Number(body.pausedCount);
      const endReason = action === "give_up" || (action === "end" && focusedSeconds === 0)
        ? "gave_up"
        : "completed";
      const { session, xpAwarded, coinsAwarded, questsUpdated, streak } = await endFocusSession(
        profileId,
        Number(body.sessionId),
        focusedSeconds,
        isRoomSession,
        Number.isFinite(pausedCount) && pausedCount >= 0 ? pausedCount : 0,
        undefined,
        endReason,
      );
      return jsonOk({ session, xpAwarded, coinsAwarded, questsUpdated, streak });
    }

    return jsonOk({ error: "Ação inválida" }, 400);
  });
}
