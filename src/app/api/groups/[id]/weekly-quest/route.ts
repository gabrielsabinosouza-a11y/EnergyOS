import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk } from "@/lib/http";
import { getGroupWeeklyQuest } from "@/lib/db/group-milestones";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const { id } = await params;
    const quest = await getGroupWeeklyQuest(profileId, Number(id));
    return jsonOk({ quest });
  });
}