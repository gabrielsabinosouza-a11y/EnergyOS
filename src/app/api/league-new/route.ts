import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, routeContext } from "@/lib/http";
import {
  getUserLeagueSnapshot,
  getLiveCohort,
  runWeeklyLeagueReset,
} from "@/lib/db/league-new";


export async function GET(request: NextRequest) {
  return handleRoute(async (context) => {
    const { profileId } = await requireAuth(request);
    context.profileId = profileId;

    try {
      console.log("[league-new] Starting weekly reset");

      await runWeeklyLeagueReset();

      console.log("[league-new] Reset completed");

      const snapshot = await getUserLeagueSnapshot(profileId);

      console.log("[league-new] Snapshot completed");

      const cohort = await getLiveCohort(profileId);

      console.log("[league-new] Cohort completed");

      return jsonOk({
        ...snapshot,
        liveCohort: { members: cohort },
      });
    } catch (error) {
      console.error("[league-new] GET FAILED:", error);
      throw error;
    }
  }, routeContext(request, "/api/league-new"));
}

// POST /api/league-new — manual weekly reset trigger (admin/cron use)
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await requireAuth(request);
    await runWeeklyLeagueReset();
    return jsonOk({ ok: true });
  });
}
