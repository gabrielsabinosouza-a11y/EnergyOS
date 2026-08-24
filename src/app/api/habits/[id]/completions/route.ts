import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import { setHabitCompletion } from "@/lib/db/habits";
import { ValidationError, parseBoolean } from "@/lib/db/validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface CompletionBody {
  completed?: unknown;
  date?: unknown;
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const raw = await context.params;
    const habitId = Number(raw.id);
    if (!Number.isInteger(habitId) || habitId <= 0) throw new ValidationError("Hábito inválido.");

    let body: CompletionBody = {};
    try {
      body = ((await request.json()) ?? {}) as CompletionBody;
    } catch {
      // corpo ausente: marca como concluído hoje
    }
    const completed = body.completed === undefined ? true : parseBoolean(body.completed, "Concluído");
    const date = typeof body.date === "string" && body.date !== "" ? body.date : undefined;

    return jsonOk(await setHabitCompletion(profileId, habitId, completed, date));
  });
}
