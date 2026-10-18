import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { createGoal, listGoals, type GoalWithProgress } from "@/lib/db/goals";
import { listHabits, type HabitWithCompletion } from "@/lib/db/habits";
import { assertObject, parseNumber, parseTitle, ValidationError } from "@/lib/db/validation";
import { parseOptionalDate, parseOptionalText } from "@/lib/db/optional-fields";
import { GOAL_CREATION_XP } from "@/lib/daily-limits";

// Force dynamic rendering - this API should never be cached
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export interface GoalBundle {
  goal: GoalWithProgress;
  habits: HabitWithCompletion[];
}

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const [goals, habits] = await Promise.all([listGoals(profileId), listHabits(profileId)]);
    const bundles: GoalBundle[] = goals.map((goal) => ({
      goal,
      habits: habits.filter((habit) => habit.goalId === goal.id),
    }));
    return jsonOk(bundles);
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const body = assertObject(await readJsonBody(request));

    // Validate required fields
    if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
      throw new ValidationError("O título é obrigatório.");
    }

    const targetValue = body.targetValue !== undefined ? Number(body.targetValue) : undefined;
    if (targetValue === undefined || targetValue < 1) {
      throw new ValidationError("A quantidade alvo deve ser pelo menos 1.");
    }

    // Validate deadline (optional, but must be valid if provided)
    if (body.deadline !== undefined && body.deadline !== null && body.deadline !== "") {
      try {
        parseOptionalDate(body.deadline, "Prazo");
      } catch (e) {
        throw new ValidationError("O prazo deve ser uma data válida (YYYY-MM-DD).");
      }
    }

    const goal = await createGoal(profileId, {
      title: parseTitle(body.title),
      categoryId: body.categoryId === undefined ? undefined : parseNumber(body.categoryId, "Categoria", { integer: true, min: 1 }),
      targetValue: parseNumber(body.targetValue, "Valor alvo"),
      frequency: "unique", // Always unique after removing monthly
      unit: body.unit === undefined ? undefined : parseOptionalText(body.unit, "Unidade"),
      deadline: body.deadline === undefined ? undefined : parseOptionalDate(body.deadline, "Prazo"),
    });
    return jsonOk({ goal, xpAwarded: GOAL_CREATION_XP }, 201);
  });
}
