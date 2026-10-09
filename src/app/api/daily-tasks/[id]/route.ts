import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, readJsonBody, routeContext } from "@/lib/http";
import { todayIso } from "@/lib/db/dates";
import {
  toggleDailyTask,
  setDailyTaskProgress,
  deactivateDailyTask,
  updateHabitMetadata,
  reorderHabits,
} from "@/lib/db/daily-tasks";
import { assertObject, ValidationError, parseEnum } from "@/lib/db/validation";
import type { HabitFrequencyType, HabitGoalType, HabitIconType } from "@/types";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async (ctx) => {
    const { profileId } = await requireAuth(request);
    ctx.profileId = profileId;
    await ensureUserBootstrap(profileId);
    const { id } = await params;
    const taskId = Number(id);
    const body = assertObject(await readJsonBody(request));

    if (body.completedCount !== undefined) {
      if (typeof body.completedCount !== "number" || !Number.isInteger(body.completedCount)) {
        throw new ValidationError("completedCount deve ser um número inteiro.");
      }
      const result = await setDailyTaskProgress(profileId, taskId, body.completedCount, todayIso());
      const parts: string[] = [];
      if (result.xpAwarded > 0) parts.push(`+${result.xpAwarded} XP`);
      if (result.coinsAwarded > 0) parts.push(`+${result.coinsAwarded} moedas`);
      return jsonOk({ ...result, message: parts.length > 0 ? parts.join(" · ") : undefined });
    }

    // If completed is present, treat as completion toggle
    if (body.completed !== undefined) {
      const completed = Boolean(body.completed);
      const result = await toggleDailyTask(profileId, taskId, completed, todayIso());
      const parts: string[] = [];
      if (result.xpAwarded > 0) parts.push(`+${result.xpAwarded} XP`);
      if (result.coinsAwarded > 0) parts.push(`+${result.coinsAwarded} moedas`);
      return jsonOk({
        task: result.task,
        xpAwarded: result.xpAwarded,
        coinsAwarded: result.coinsAwarded,
        message: parts.length > 0 ? parts.join(" · ") : undefined,
      });
    }

    // Otherwise, treat as metadata update
    const updates: Parameters<typeof updateHabitMetadata>[2] = {};
    const text = (key: string, nullable = false): string | null | undefined => {
      const value = body[key];
      if (value === undefined) return undefined;
      if (nullable && value === null) return null;
      if (typeof value !== "string") throw new ValidationError(`${key} deve ser texto.`);
      return value;
    };
    const requiredText = (key: string): string | undefined => {
      const value = text(key);
      if (value === null) throw new ValidationError(`${key} não pode ser nulo.`);
      return value;
    };
    const number = (key: string, nullable = false): number | null | undefined => {
      const value = body[key];
      if (value === undefined) return undefined;
      if (nullable && value === null) return null;
      if (typeof value !== "number" || !Number.isFinite(value)) throw new ValidationError(`${key} deve ser numérico.`);
      return value;
    };

    const title = requiredText("title"); if (title !== undefined) updates.title = title;
    const dailyTarget = number("dailyTarget");
    if (dailyTarget !== undefined) {
      if (dailyTarget === null || !Number.isInteger(dailyTarget) || dailyTarget < 1) throw new ValidationError("A meta diária deve ser um inteiro maior que zero.");
      updates.dailyTarget = dailyTarget;
    }
    const iconType = body.iconType === undefined ? undefined : parseEnum<HabitIconType>(body.iconType, ["asset", "emoji", "image"], "Ícone");
    if (iconType !== undefined) updates.iconType = iconType;
    const iconValue = requiredText("iconValue"); if (iconValue !== undefined) updates.iconValue = iconValue;
    const color = requiredText("color"); if (color !== undefined) updates.color = color;
    const frequencyType = body.frequencyType === undefined ? undefined : parseEnum<HabitFrequencyType>(body.frequencyType, ["daily", "weekdays", "times_per_week"], "Frequência");
    if (frequencyType !== undefined) updates.frequencyType = frequencyType;
    if (body.frequencyDays !== undefined) {
      if (body.frequencyDays !== null && (!Array.isArray(body.frequencyDays) || body.frequencyDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) throw new ValidationError("Dias da semana inválidos.");
      updates.frequencyDays = body.frequencyDays as number[] | null;
    }
    const frequencyTarget = number("frequencyTarget", true); if (frequencyTarget !== undefined) updates.frequencyTarget = frequencyTarget;
    const goalType = body.goalType === undefined ? undefined : parseEnum<HabitGoalType>(body.goalType, ["check", "measurable"], "Tipo de meta");
    if (goalType !== undefined) updates.goalType = goalType;
    const targetValue = number("targetValue", true); if (targetValue !== undefined) updates.targetValue = targetValue;
    const unit = text("unit", true); if (unit !== undefined) updates.unit = unit;
    const description = text("description", true); if (description !== undefined) updates.description = description;
    const category = text("category", true); if (category !== undefined) updates.category = category;
    const startDate = text("startDate", true); if (startDate !== undefined) updates.startDate = startDate;
    const reminderTime = text("reminderTime", true); if (reminderTime !== undefined) updates.reminderTime = reminderTime;

    if (Object.keys(updates).length === 0) {
      throw new ValidationError("Nenhuma alteração fornecida.");
    }

    const task = await updateHabitMetadata(profileId, taskId, updates);
    return jsonOk({ task });
  }, routeContext(request, "/api/daily-tasks/[id]"));
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async (ctx) => {
    const { profileId } = await requireAuth(request);
    ctx.profileId = profileId;
    await ensureUserBootstrap(profileId);
    const { id } = await params;
    // Soft-archive: keeps the task row and its completion history, hides it
    // from the daily checklist from now on.
    await deactivateDailyTask(profileId, Number(id));
    return jsonOk({ ok: true });
  }, routeContext(request, "/api/daily-tasks/[id]"));
}

export async function PUT(request: NextRequest) {
  return handleRoute(async (ctx) => {
    const { profileId } = await requireAuth(request);
    ctx.profileId = profileId;
    await ensureUserBootstrap(profileId);
    const body = assertObject(await readJsonBody(request));
    const order = body.order;
    if (!Array.isArray(order)) {
      throw new ValidationError("Ordem inválida.");
    }
    await reorderHabits(profileId, order.map((x: number) => Number(x)));
    return jsonOk({ ok: true });
  }, routeContext(request, "/api/daily-tasks/reorder"));
}
