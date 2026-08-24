import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { deleteHabit, HABIT_FREQUENCY_VALUES, updateHabit } from "@/lib/db/habits";
import { assertObject, parseBoolean, parseEnum, parseNumber, parseTitle } from "@/lib/db/validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function resolveHabitId(context: RouteContext): Promise<number> {
  const { id } = await context.params;
  return parseNumber(id, "Identificador do hábito", { integer: true, min: 1 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const habitId = await resolveHabitId(context);
    const body = assertObject(await readJsonBody(request));

    const patch: Parameters<typeof updateHabit>[2] = {};
    if (body.title !== undefined) patch.title = parseTitle(body.title);
    if (body.active !== undefined) patch.active = parseBoolean(body.active, "Ativo");
    if (body.frequency !== undefined) patch.frequency = parseEnum(body.frequency, HABIT_FREQUENCY_VALUES, "Frequência");

    return jsonOk({ habit: await updateHabit(profileId, habitId, patch) });
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const habitId = await resolveHabitId(context);
    await deleteHabit(profileId, habitId);
    return jsonOk({ ok: true });
  });
}
