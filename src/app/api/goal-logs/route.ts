import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import {
  applyGoalLogAction,
  listGoalLogsInRange,
  GOAL_LOG_ACTIONS,
} from "@/lib/db/goal-logs";
import { assertObject, parseDate, parseEnum, parseNumber } from "@/lib/db/validation";

/**
 * GET /api/goal-logs?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Lista os check-ins do usuário autenticado no intervalo (heatmap/histórico).
 *
 * POST /api/goal-logs  { goalId, action, date?, amount? }
 * Aplica um check-in com transição de recompensa (XP/moedas/liga). Sempre no
 * escopo do profile autenticado — o corpo nunca escolhe o profile_id.
 */

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const params = request.nextUrl.searchParams;
    const from = parseDate(params.get("from"), "Data inicial");
    const to = parseDate(params.get("to"), "Data final");
    const logs = await listGoalLogsInRange(profileId, from, to);
    return jsonOk({ logs });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const body = assertObject(await readJsonBody(request));
    const goalId = parseNumber(body.goalId, "Meta", { integer: true, min: 1 });
    const action = parseEnum(body.action, GOAL_LOG_ACTIONS, "Ação");
    const date = body.date === undefined ? undefined : parseDate(body.date, "Data");
    const amount = body.amount === undefined
      ? undefined
      : parseNumber(body.amount, "Quantidade", { min: 0, max: 1_000_000 });

    const result = await applyGoalLogAction(profileId, goalId, { action, date, amount });
    return jsonOk({
      goal: result.goal,
      log: result.log,
      xpAwarded: result.xpAwarded,
      coinsAwarded: result.coinsAwarded,
      revertedXp: result.revertedXp,
      revertedCoins: result.revertedCoins,
    });
  });
}
