import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import { getGroupSynchronyStatus } from "@/lib/db/group-synchrony";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const synchrony = await getGroupSynchronyStatus(profileId, Number(id));
    return jsonOk({ synchrony });
  });
}
