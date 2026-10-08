import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { reorderHabits } from "@/lib/db/daily-tasks";
import { assertObject, ValidationError } from "@/lib/db/validation";

export async function PUT(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const body = assertObject(await readJsonBody(request));
    const order = body.order;
    if (!Array.isArray(order)) {
      throw new ValidationError("Ordem inválida.");
    }
    await reorderHabits(profileId, order.map((x: number) => Number(x)));
    return jsonOk({ ok: true });
  });
}
