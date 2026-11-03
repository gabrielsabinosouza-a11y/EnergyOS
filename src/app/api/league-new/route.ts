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
    await runWeeklyLeagueReset();
    const snapshot = await getUserLeagueSnapshot(profileId);
    const cohort = await getLiveCohort(profileId);
    return jsonOk({ ...snapshot, liveCohort: { members: cohort } });
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
