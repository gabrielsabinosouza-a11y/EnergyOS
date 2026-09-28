import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk } from "@/lib/http";
import { getGroupMilestones } from "@/lib/db/group-milestones";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const { id } = await params;
    const result = await getGroupMilestones(profileId, Number(id));
    return jsonOk(result);
  });
}
