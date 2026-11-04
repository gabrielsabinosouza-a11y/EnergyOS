import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody, routeContext } from "@/lib/http";
import {
  acknowledgeLeagueWeeklyResults,
  getPendingLeagueWeeklyResults,
  runWeeklyLeagueReset,
} from "@/lib/db/league-new";

export async function GET(request: NextRequest) {
  return handleRoute(async (context) => {
    const { profileId } = await requireAuth(request);
    context.profileId = profileId;
    await runWeeklyLeagueReset();
    const results = await getPendingLeagueWeeklyResults(profileId);
    return jsonOk({ results });
  }, routeContext(request, "/api/league-new/results"));
}

export async function POST(request: NextRequest) {
  return handleRoute(async (context) => {
    const { profileId } = await requireAuth(request);
    context.profileId = profileId;
    await readJsonBody(request);
    await acknowledgeLeagueWeeklyResults(profileId);
    return jsonOk({ ok: true });
  }, routeContext(request, "/api/league-new/results"));
}
