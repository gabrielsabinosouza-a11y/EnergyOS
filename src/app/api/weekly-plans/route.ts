import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { listWeeklyPlans, createWeeklyPlan } from "@/lib/db/weekly-plans";
import { ensureWeeklyPlanSeriesSchema, listWeeklyPlanOccurrences, listUnscheduledPlanItems } from "@/lib/db/weekly-plans-series";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    await ensureWeeklyPlanSeriesSchema();
    const url = new URL(request.url);
    const weekStart = url.searchParams.get("weekStart") ?? undefined;
    const unscheduled = url.searchParams.get("unscheduled");

    // Tarefas sem data: não pertencem a nenhuma semana do calendário.
    if (unscheduled) {
      return jsonOk(await listUnscheduledPlanItems(profileId));
    }

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
    await ensureWeeklyPlanSeriesSchema();

    const body = await readJsonBody(request);
    const note = (body.note ?? body.description ?? null) as string | null;
    const repeatType = body.repeatType as string | undefined;

    // If it's a recurring plan (weekly or interval), create a series
    if (repeatType && repeatType !== "once") {
      const { createWeeklyPlanSeries } = await import("@/lib/db/weekly-plans-series");
      const series = await createWeeklyPlanSeries(profileId, {
        title: body.title as string,
        categoryId: body.categoryId as number | undefined,
        note: note as string | null,
        repeatType: repeatType as "weekly" | "interval",
        repeatDays: body.repeatDays as number[] | undefined,
        repeatInterval: body.repeatInterval as number | undefined,
        startTime: body.startTime as string | undefined,
        startDate: body.planDate as string,
        endType: (body.repeatEndType as string | undefined) as "never" | "date" | "count" | undefined,
        endDate: body.repeatUntil as string | undefined,
        endCount: body.repeatEndCount as number | undefined,
        reminderOffsetMin: body.reminderOffsetMin as number | undefined,
      });
      return jsonOk({ series }, 201);
    }

    // Otherwise, create a single plan
    const plan = await createWeeklyPlan(profileId, {
      planDate: body.planDate as string | null | undefined,
      title: body.title as string,
      categoryId: body.categoryId as number | undefined,
      taskId: body.taskId as number | undefined,
      startTime: body.startTime as string | undefined,
      endTime: body.endTime as string | undefined,
      allDay: body.allDay as boolean | undefined,
      note: note as string | null,
      reminderOffsetMin: body.reminderOffsetMin as number | undefined,
    });

    return jsonOk({ plan }, 201);
  });
}