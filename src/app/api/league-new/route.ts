import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import {
  getUserLeagueSnapshot,
  getLiveCohort,
  runWeeklyLeagueReset,
} from "@/lib/db/league-new";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    // Run reset check on every fetch (idempotent — only acts if week has turned)
    await runWeeklyLeagueReset().catch(() => undefined);
    const snapshot = await getUserLeagueSnapshot(profileId);
    const cohort = await getLiveCohort(profileId);
    return jsonOk({ ...snapshot, liveCohort: { members: cohort } });
  });
}

// POST /api/league-new — manual weekly reset trigger (admin/cron use)
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await requireAuth(request);
    await runWeeklyLeagueReset();
    return jsonOk({ ok: true });
  });
}
