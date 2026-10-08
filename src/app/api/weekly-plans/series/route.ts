import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { ensureWeeklyPlanSeriesSchema, listWeeklyPlanSeries, createWeeklyPlanSeries } from "@/lib/db/weekly-plans-series";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    await ensureWeeklyPlanSeriesSchema();
    return jsonOk(await listWeeklyPlanSeries(profileId));
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    await ensureWeeklyPlanSeriesSchema();
    const body = await readJsonBody(request);
    const series = await createWeeklyPlanSeries(profileId, {
      title: body.title as string,
      categoryId: body.categoryId as number | undefined,
      iconType: body.iconType as "asset" | "emoji" | "image" | null | undefined,
      iconValue: body.iconValue as string | null | undefined,
      color: body.color as string | null | undefined,
      note: body.note as string | null | undefined,
      repeatType: body.repeatType as "once" | "weekly" | "interval",
      repeatDays: body.repeatDays as number[] | null | undefined,
      repeatInterval: body.repeatInterval as number | null | undefined,
      startTime: body.startTime as string | null | undefined,
      durationMinutes: body.durationMinutes as number | null | undefined,
      startDate: body.startDate as string,
      endType: body.endType as "never" | "date" | "count" | undefined,
      endDate: body.endDate as string | null | undefined,
      endCount: body.endCount as number | null | undefined,
      timezone: body.timezone as string | undefined,
    });
    return jsonOk({ series }, 201);
  });
}

