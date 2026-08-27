import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { deleteGoal, updateGoal, GOAL_FREQUENCY_VALUES } from "@/lib/db/goals";
import { assertObject, parseEnum, parseNumber, parseTitle } from "@/lib/db/validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function resolveGoalId(context: RouteContext): Promise<number> {
  const { id } = await context.params;
  return parseNumber(id, "Identificador da meta", { integer: true, min: 1 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const goalId = await resolveGoalId(context);
    const body = assertObject(await readJsonBody(request));

    const patch: Parameters<typeof updateGoal>[2] = {};
    if (body.title !== undefined) patch.title = parseTitle(body.title);
    if (body.categoryId !== undefined) patch.categoryId = parseNumber(body.categoryId, "Categoria", { integer: true, min: 1 });
    if (body.frequency !== undefined) patch.frequency = parseEnum(body.frequency, GOAL_FREQUENCY_VALUES, "Frequência");
    if (body.targetValue !== undefined) patch.targetValue = parseNumber(body.targetValue, "Valor alvo");
    if (body.currentValue !== undefined) patch.currentValue = parseNumber(body.currentValue, "Progresso atual");

    return jsonOk({ goal: await updateGoal(profileId, goalId, patch) });
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const goalId = await resolveGoalId(context);
    await deleteGoal(profileId, goalId);
    return jsonOk({ ok: true });
  });
}
