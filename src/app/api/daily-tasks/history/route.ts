import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, routeContext } from "@/lib/http";
import { listDailyTaskHistory } from "@/lib/db/daily-tasks";
import { parseDate, ValidationError } from "@/lib/db/validation";

export async function GET(request: NextRequest) {
  return handleRoute(async (ctx) => {
    const { profileId } = await requireAuth(request);
    ctx.profileId = profileId;
    await ensureUserBootstrap(profileId);
    const from = parseDate(request.nextUrl.searchParams.get("from"), "Data inicial");
    const to = parseDate(request.nextUrl.searchParams.get("to"), "Data final");
    if (from > to) throw new ValidationError("Intervalo de datas inválido.");
    const logs = await listDailyTaskHistory(profileId, from, to);
    return jsonOk({ logs });
  }, routeContext(request, "/api/daily-tasks/history"));
}
