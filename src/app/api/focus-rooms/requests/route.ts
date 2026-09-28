import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk } from "@/lib/http";
import { getOwnPendingJoinRequests } from "@/lib/db/focus-rooms";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    return jsonOk({ requests: await getOwnPendingJoinRequests(profileId) });
  });
}
