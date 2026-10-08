import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { listWeeklyPlans, createWeeklyPlan } from "@/lib/db/weekly-plans";
import { ensureWeeklyPlanSeriesSchema, listWeeklyPlanOccurrences } from "@/lib/db/weekly-plans-series";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    await ensureWeeklyPlanSeriesSchema();
    const url = new URL(request.url);
    const weekStart = url.searchParams.get("weekStart") ?? undefined;

    if (weekStart) {
      return jsonOk(await listWeeklyPlanOccurrences(profileId, weekStart));
    }

    return jsonOk(await listWeeklyPlans(profileId, weekStart));
    });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const body = await readJsonBody(request);
    const plan = await createWeeklyPlan(profileId, {
      planDate: body.planDate as string,
      title: body.title as string,
      categoryId: body.categoryId as number | undefined,
      taskId: body.taskId as number | undefined,
      startTime: body.startTime as string | undefined,
      endTime: body.endTime as string | undefined,
      allDay: body.allDay as boolean | undefined,
    });
    return jsonOk({ plan }, 201);
  });
}
