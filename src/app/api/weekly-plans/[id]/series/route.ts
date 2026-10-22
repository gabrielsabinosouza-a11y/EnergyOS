import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { ensureWeeklyPlanSeriesSchema, convertWeeklyPlanToSeries } from "@/lib/db/weekly-plans-series";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    await ensureWeeklyPlanSeriesSchema();
    const { id } = await params;
    const body = await readJsonBody(request);
    const result = await convertWeeklyPlanToSeries(profileId, Number(id), {
      title: body.title as string,
      categoryId: body.categoryId as number | undefined,
      repeatDays: body.repeatDays as number[],
      startTime: body.startTime as string | null | undefined,
      durationMinutes: body.durationMinutes as number | null | undefined,
      startDate: body.startDate as string,
      endType: body.endType as "never" | "date" | "count" | undefined,
      endDate: body.endDate as string | null | undefined,
      endCount: body.endCount as number | null | undefined,
      timezone: "America/Sao_Paulo",
      reminderOffsetMin: body.reminderOffsetMin as number | null | undefined,
    });
    return jsonOk(result);
  });
}
