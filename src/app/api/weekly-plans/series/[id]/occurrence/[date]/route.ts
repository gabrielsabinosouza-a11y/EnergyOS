import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk } from "@/lib/http";
import { ensureWeeklyPlanSeriesSchema, setOccurrenceCompleted } from "@/lib/db/weekly-plans-series";

/** PATCH /api/weekly-plans/series/:id/occurrence/:date — toggle completion */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; date: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    await ensureWeeklyPlanSeriesSchema();
    const { id, date } = await params;
    let body: Record<string, unknown> = {};
    try { body = await request.json(); } catch { /* empty body = complete */ }
    const completed = body.completed !== false;
    const reward = await setOccurrenceCompleted(profileId, Number(id), date, completed);
    return jsonOk({ ok: true, ...reward });
  });
}

