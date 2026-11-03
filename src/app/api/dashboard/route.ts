import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, routeContext } from "@/lib/http";
import { buildDashboardSnapshot } from "@/lib/db/dashboard";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId, displayName, email, role } = await requireAuth(request);
    const snapshot = await buildDashboardSnapshot(profileId, displayName === null ? undefined : displayName, email === null ? undefined : email, role);
    return jsonOk(snapshot);
  }, routeContext(request, "/api/dashboard"));
}
