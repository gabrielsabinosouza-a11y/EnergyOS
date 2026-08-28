import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import { ensureUserDailyTasks } from "@/lib/db/daily-tasks";
import { todayIso } from "@/lib/db/dates";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const today = todayIso();
    const tasks = await ensureUserDailyTasks(profileId, today);
    return jsonOk({ tasks, date: today });
  });
}
