import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import type { WeeklyPlan } from "@/types";
import { completeWeeklyPlan, deleteWeeklyPlan, setWeeklyPlanCompleted, updateWeeklyPlan } from "@/lib/db/weekly-plans";
import { awardTaskXP } from "@/lib/db/xp";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // corpo vazio = concluir (compatível com o cliente antigo)
    }
    const planId = Number(id);
    let plan: WeeklyPlan;
    if (body.completed === false) {
      plan = await setWeeklyPlanCompleted(profileId, planId, false);
    } else {
      plan = await setWeeklyPlanCompleted(profileId, planId, true);
      await awardTaskXP(profileId, plan.id, 10).catch(() => {});
    }
    return jsonOk({ plan });
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const body = await readJsonBody(request);
    const plan = await updateWeeklyPlan(profileId, Number(id), {
      title: body.title as string | undefined,
      categoryId: body.categoryId as number | undefined,
      planDate: body.planDate as string | undefined,
    });
    return jsonOk({ plan });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    await deleteWeeklyPlan(profileId, Number(id));
    return jsonOk({ ok: true });
  });
}
