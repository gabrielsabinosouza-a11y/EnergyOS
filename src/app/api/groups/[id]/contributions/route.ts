import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import { getGroupMemberContributions, type Period } from "@/lib/db/group-leaderboard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const period = (request.nextUrl.searchParams.get("period") as Period) ?? "ALL_TIME";
    const result = await getGroupMemberContributions(profileId, Number(id), period);
    return jsonOk(result);
  });
}
