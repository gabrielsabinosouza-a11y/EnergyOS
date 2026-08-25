import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import { completeWeeklyPlan, deleteWeeklyPlan } from "@/lib/db/weekly-plans";
import { awardTaskXP } from "@/lib/db/xp";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const plan = await completeWeeklyPlan(profileId, Number(id));
    await awardTaskXP(profileId, plan.id, 10);
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
