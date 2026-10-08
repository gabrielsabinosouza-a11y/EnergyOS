import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import {
  ensureWeeklyPlanSeriesSchema,
  getWeeklyPlanSeries,
  updateWeeklyPlanSeries,
  deleteWeeklyPlanSeries,
} from "@/lib/db/weekly-plans-series";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    await ensureWeeklyPlanSeriesSchema();
    const { id } = await params;
    const series = await getWeeklyPlanSeries(profileId, Number(id));
    return jsonOk({ series });
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    await ensureWeeklyPlanSeriesSchema();
    const { id } = await params;
    const body = await readJsonBody(request);
    const series = await updateWeeklyPlanSeries(profileId, Number(id), {
      title: body.title as string | undefined,
      categoryId: body.categoryId as number | undefined,
      iconType: body.iconType as "asset" | "emoji" | "image" | null | undefined,
      iconValue: body.iconValue as string | null | undefined,
      color: body.color as string | null | undefined,
      note: body.note as string | null | undefined,
      repeatType: body.repeatType as "once" | "weekly" | "interval" | undefined,
      repeatDays: body.repeatDays as number[] | null | undefined,
      repeatInterval: body.repeatInterval as number | null | undefined,
      startTime: body.startTime as string | null | undefined,
      durationMinutes: body.durationMinutes as number | null | undefined,
      startDate: body.startDate as string | undefined,
      endType: body.endType as "never" | "date" | "count" | undefined,
      endDate: body.endDate as string | null | undefined,
      endCount: body.endCount as number | null | undefined,
    });
    return jsonOk({ series });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    await ensureWeeklyPlanSeriesSchema();
    const { id } = await params;
    await deleteWeeklyPlanSeries(profileId, Number(id));
    return jsonOk({ ok: true });
  });
}


