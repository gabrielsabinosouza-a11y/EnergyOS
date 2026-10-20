import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { deleteWeeklyPlan, setWeeklyPlanCompleted, updateWeeklyPlan } from "@/lib/db/weekly-plans";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const { id } = await params;
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // corpo vazio = concluir (compatível com o cliente antigo)
    }
    const planId = Number(id);
    if (body.completed === false) {
      return jsonOk(await setWeeklyPlanCompleted(profileId, planId, false));
    }
    return jsonOk(await setWeeklyPlanCompleted(profileId, planId, true));
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const { id } = await params;
    const body = await readJsonBody(request);
    const plan = await updateWeeklyPlan(profileId, Number(id), {
      title: body.title as string | undefined,
      categoryId: body.categoryId as number | undefined,
      planDate: body.planDate as string | undefined,
      startTime: body.startTime as string | null | undefined,
      endTime: body.endTime as string | null | undefined,
    });
    return jsonOk({ plan });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const { id } = await params;
    await deleteWeeklyPlan(profileId, Number(id));
    return jsonOk({ ok: true });
  });
}
