import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { todayIso } from "@/lib/db/dates";
import {
  toggleDailyTask,
  deactivateDailyTask,
  updateHabitMetadata,
  reorderHabits,
} from "@/lib/db/daily-tasks";
import { assertObject, ValidationError } from "@/lib/db/validation";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const { id } = await params;
    const taskId = Number(id);
    const body = assertObject(await readJsonBody(request));

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
    const updates: {
      title?: string;
      iconType?: string;
      iconValue?: string;
      color?: string;
      frequencyType?: string;
      frequencyDays?: number[] | null;
      frequencyTarget?: number | null;
      goalType?: string;
      targetValue?: number | null;
      unit?: string | null;
      description?: string | null;
      category?: string | null;
      startDate?: string | null;
      reminderTime?: string | null;
    } = {};

    if (body.title !== undefined) updates.title = body.title;
    if (body.iconType !== undefined) updates.iconType = body.iconType;
    if (body.iconValue !== undefined) updates.iconValue = body.iconValue;
    if (body.color !== undefined) updates.color = body.color;
    if (body.frequencyType !== undefined) updates.frequencyType = body.frequencyType;
    if (body.frequencyDays !== undefined) updates.frequencyDays = body.frequencyDays;
    if (body.frequencyTarget !== undefined) updates.frequencyTarget = body.frequencyTarget;
    if (body.goalType !== undefined) updates.goalType = body.goalType;
    if (body.targetValue !== undefined) updates.targetValue = body.targetValue;
    if (body.unit !== undefined) updates.unit = body.unit;
    if (body.description !== undefined) updates.description = body.description;
    if (body.category !== undefined) updates.category = body.category;
    if (body.startDate !== undefined) updates.startDate = body.startDate;
    if (body.reminderTime !== undefined) updates.reminderTime = body.reminderTime;

    if (Object.keys(updates).length === 0) {
      throw new ValidationError("Nenhuma alteração fornecida.");
    }

    const task = await updateHabitMetadata(profileId, taskId, updates);
    return jsonOk({ task });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const { id } = await params;
    // Soft-archive: keeps the task row and its completion history, hides it
    // from the daily checklist from now on.
    await deactivateDailyTask(profileId, Number(id));
    return jsonOk({ ok: true });
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const { id } = await params;
    const body = assertObject(await readJsonBody(request));
    const order = body.order;
    if (!Array.isArray(order)) {
      throw new ValidationError("Ordem inválida.");
    }
    await reorderHabits(profileId, order.map((x: number) => Number(x)));
    return jsonOk({ ok: true });
  });
}
