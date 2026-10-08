import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk } from "@/lib/http";
import { ensureWeeklyPlanSeriesSchema, skipOccurrence } from "@/lib/db/weekly-plans-series";

/** PATCH /api/weekly-plans/series/:id/occurrence/:date/skip — skip occurrence */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; date: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    await ensureWeeklyPlanSeriesSchema();
    const { id, date } = await params;
    await skipOccurrence(profileId, Number(id), date);
    return jsonOk({ ok: true });
  });
}

