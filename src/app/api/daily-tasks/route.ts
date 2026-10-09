import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, readJsonBody, routeContext } from "@/lib/http";
import { listDailyTasks, getAllHabits, createDailyTask, type CreateHabitPayload } from "@/lib/db/daily-tasks";
import { todayIso } from "@/lib/db/dates";

export async function GET(request: NextRequest) {
  return handleRoute(async (ctx) => {
    const { profileId } = await requireAuth(request);
    ctx.profileId = profileId;
    await ensureUserBootstrap(profileId);
    const today = todayIso();
    const url = new URL(request.url);
    const all = url.searchParams.get("all") === "true";
    const tasks = all ? await getAllHabits(profileId, today) : await listDailyTasks(profileId, today);
    return jsonOk({ tasks, date: today });
  }, routeContext(request, "/api/daily-tasks"));
}

export async function POST(request: NextRequest) {
  return handleRoute(async (ctx) => {
    const { profileId } = await requireAuth(request);
    ctx.profileId = profileId;
    await ensureUserBootstrap(profileId);
    const body = await readJsonBody(request);
    const today = todayIso();
    const task = await createDailyTask(profileId, today, body as unknown as CreateHabitPayload);
    return jsonOk({ task, date: today });
  }, routeContext(request, "/api/daily-tasks"));
}
