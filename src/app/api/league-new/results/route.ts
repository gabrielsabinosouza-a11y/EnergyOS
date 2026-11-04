import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody, routeContext } from "@/lib/http";
import { BadRequestError } from "@/lib/errors";
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
    const body = await readJsonBody(request);
    const ids = body.ids;
    if (
      !Array.isArray(ids) ||
      !ids.every((id): id is number =>
        typeof id === "number" && Number.isSafeInteger(id) && id > 0
      )
    ) {
      throw new BadRequestError("IDs de resultados inválidos.");
    }
    await acknowledgeLeagueWeeklyResults(profileId, ids);
    return jsonOk({ ok: true });
  }, routeContext(request, "/api/league-new/results"));
}
