import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { createGoal, listGoals, GOAL_FREQUENCY_VALUES, type GoalWithProgress } from "@/lib/db/goals";
import { listHabits, type HabitWithCompletion } from "@/lib/db/habits";
import { assertObject, parseEnum, parseNumber, parseTitle } from "@/lib/db/validation";

export interface GoalBundle {
  goal: GoalWithProgress;
  habits: HabitWithCompletion[];
}

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
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
    const body = assertObject(await readJsonBody(request));
    const goal = await createGoal(profileId, {
      title: parseTitle(body.title),
      categoryId: body.categoryId === undefined ? undefined : parseNumber(body.categoryId, "Categoria", { integer: true, min: 1 }),
      targetValue: parseNumber(body.targetValue, "Valor alvo"),
      frequency: parseEnum(body.frequency, GOAL_FREQUENCY_VALUES, "Frequência"),
    });
    return jsonOk({ goal }, 201);
  });
}
