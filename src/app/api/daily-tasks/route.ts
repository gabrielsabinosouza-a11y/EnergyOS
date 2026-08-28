import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { listDailyTasks, createDailyTask } from "@/lib/db/daily-tasks";
import { todayIso } from "@/lib/db/dates";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const today = todayIso();
    const tasks = await listDailyTasks(profileId, today);
    return jsonOk({ tasks, date: today });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const body = await readJsonBody(request);
    const title = typeof body.title === "string" ? body.title : "";
    const today = todayIso();
    const task = await createDailyTask(profileId, today, title);
    return jsonOk({ task, date: today });
  });
}
