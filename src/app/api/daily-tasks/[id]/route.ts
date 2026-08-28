import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import { toggleDailyTask } from "@/lib/db/daily-tasks";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const progressId = Number(id);
    const body = await request.json().catch(() => ({}));
    const completed = Boolean(body?.completed);

    const result = await toggleDailyTask(profileId, progressId, completed);

    return jsonOk({
      task: result.task,
      xpAwarded: result.xpAwarded,
      message: result.xpAwarded > 0 ? `+${result.xpAwarded} XP!` : undefined,
    });
  });
}
