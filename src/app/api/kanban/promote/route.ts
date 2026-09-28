import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { promoteTaskToKanban } from "@/lib/db/kanban";

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const body = await readJsonBody(request);
    const task = await promoteTaskToKanban(profileId, Number(body.taskId));
    return jsonOk({ task }, 201);
  });
}
