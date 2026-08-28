import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import { toggleDailyTask, deleteDailyTask } from "@/lib/db/daily-tasks";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const progressId = Number(id);
    const body = await request.json().catch(() => ({}));
    const completed = Boolean(body?.completed);

    const result = await toggleDailyTask(profileId, progressId, completed);

    const parts: string[] = [];
    if (result.xpAwarded > 0) parts.push(`+${result.xpAwarded} XP`);
    if (result.coinsAwarded > 0) parts.push(`+${result.coinsAwarded} moedas`);

    return jsonOk({
      task: result.task,
      xpAwarded: result.xpAwarded,
      coinsAwarded: result.coinsAwarded,
      message: parts.length > 0 ? parts.join(" · ") : undefined,
    });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    await deleteDailyTask(profileId, Number(id));
    return jsonOk({ ok: true });
  });
}
