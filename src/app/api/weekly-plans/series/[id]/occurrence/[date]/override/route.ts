import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { ensureWeeklyPlanSeriesSchema, updateOccurrenceOverride } from "@/lib/db/weekly-plans-series";

/** PATCH /api/weekly-plans/series/:id/occurrence/:date/override — edit single occurrence */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; date: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    await ensureWeeklyPlanSeriesSchema();
    const { id, date } = await params;
    const body = await readJsonBody(request);
    await updateOccurrenceOverride(profileId, Number(id), date, {
      title: body.title as string | undefined,
      startTime: body.startTime as string | null | undefined,
    });
    return jsonOk({ ok: true });
  });
}

