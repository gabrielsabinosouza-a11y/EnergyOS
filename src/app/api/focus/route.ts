import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { startFocusSession, endFocusSession, getFocusHistory, getTodayFocusStats } from "@/lib/db/focus";
import { getUserXP } from "@/lib/db/xp";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const [history, todayStats, xp] = await Promise.all([
      getFocusHistory(profileId),
      getTodayFocusStats(profileId),
      getUserXP(profileId),
    ]);
    return jsonOk({ history, todayStats, xp });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const body = await readJsonBody(request);
    const action = body.action as string;

    if (action === "start") {
      const targetDurationMinutes = Number(body.targetDurationMinutes) || 25;
      const session = await startFocusSession(profileId, targetDurationMinutes, body.taskId as number | undefined);
      return jsonOk({ session }, 201);
    }

    if (action === "end") {
      const focusedSeconds = Number(body.focusedSeconds) || 0;
      const { session, xpAwarded } = await endFocusSession(profileId, Number(body.sessionId), focusedSeconds);
      return jsonOk({ session, xpAwarded });
    }

    return jsonOk({ error: "Ação inválida" }, 400);
  });
}
