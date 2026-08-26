import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import {
  getUserLeagueSnapshot,
  getLiveCohort,
} from "@/lib/db/league-new";

// GET /api/league-new - Get user's current league snapshot
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const snapshot = await getUserLeagueSnapshot(profileId);
    
    // Get live cohort
    const cohort = await getLiveCohort(profileId);
    
    return jsonOk({
      ...snapshot,
      liveCohort: {
        members: cohort,
      },
    });
  });
}
