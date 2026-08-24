import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { createHabit, HABIT_FREQUENCY_VALUES } from "@/lib/db/habits";
import { assertObject, parseEnum, parseNumber, parseTitle } from "@/lib/db/validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const raw = await context.params;
    const goalId = parseNumber(raw.id, "Identificador da meta", { integer: true, min: 1 });
    const body = assertObject(await readJsonBody(request));
    const habit = await createHabit(profileId, {
      goalId,
      title: parseTitle(body.title),
      frequency: parseEnum(body.frequency, HABIT_FREQUENCY_VALUES, "Frequência"),
    });
    return jsonOk({ habit }, 201);
  });
}
