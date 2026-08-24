import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonError, jsonOk } from "@/lib/http";
import { generateWeeklyInsights, listInsights } from "@/lib/db/insights";
import { isValidDateString } from "@/lib/db/validation";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const weekStartParam = request.nextUrl.searchParams.get("weekStart");
    if (weekStartParam !== null && !isValidDateString(weekStartParam)) {
      return jsonError(400, "weekStart deve ser uma data YYYY-MM-DD válida.");
    }
    const insights = await listInsights(profileId, weekStartParam ?? undefined);
    return jsonOk({ insights });
  });
}

/** Recalcula os insights da semana corrente a partir dos dados do banco. */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const insights = await generateWeeklyInsights(profileId);
    return jsonOk({ insights }, 201);
  });
}
