import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { listWeeklyPlans, createWeeklyPlan } from "@/lib/db/weekly-plans";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const url = new URL(request.url);
    const weekStart = url.searchParams.get("weekStart") ?? undefined;
    return jsonOk(await listWeeklyPlans(profileId, weekStart));
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const body = await readJsonBody(request);
    const plan = await createWeeklyPlan(profileId, {
      planDate: body.planDate as string,
      title: body.title as string,
      category: body.category as any,
      taskId: body.taskId as number | undefined,
      startTime: body.startTime as string | undefined,
      endTime: body.endTime as string | undefined,
      allDay: body.allDay as boolean | undefined,
    });
    return jsonOk({ plan }, 201);
  });
}
