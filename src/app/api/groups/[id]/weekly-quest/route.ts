import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import { getGroupWeeklyQuest, claimGroupWeeklyQuest } from "@/lib/db/group-milestones";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const quest = await getGroupWeeklyQuest(profileId, Number(id));
    return jsonOk({ quest });
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const result = await claimGroupWeeklyQuest(profileId, Number(id));
    return jsonOk(result);
  });
}
