import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import { buildDashboardSnapshot } from "@/lib/db/dashboard";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId, displayName, email } = await requireAuth(request);
    const snapshot = await buildDashboardSnapshot(profileId, displayName ?? undefined, email ?? undefined);
    return jsonOk(snapshot);
  });
}
