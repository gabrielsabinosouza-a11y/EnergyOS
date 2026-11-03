
import type { NextRequest } from "next/server";

import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { ValidationError } from "@/lib/db/validation";

import {
  listKanbanTasks,
  createKanbanTask,
  listKanbanLabels,
} from "@/lib/db/kanban";

type KanbanStatus = "todo" | "doing" | "done";
type KanbanPriority = "low" | "medium" | "high";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);

    const [tasks, labels] = await Promise.all([
      listKanbanTasks(profileId),
      listKanbanLabels(profileId),
    ]);

    return jsonOk({ tasks, labels });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    console.info("[Kanban POST] Authenticated profile:", profileId);

    await ensureUserBootstrap(profileId);
    console.info("[Kanban POST] Bootstrap completed for profile:", profileId);

    const body = await readJsonBody(request);
    console.info("[Kanban POST] Request body:", JSON.stringify(body, null, 2));

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ValidationError("Invalid request body.");
    }

    const data = body as Record<string, unknown>;

    // Validate title
    if (typeof data.title !== "string" || !data.title.trim()) {
      throw new ValidationError("Task title is required.");
    }

    const title = data.title.trim();

    if (title.length > 200) {
      throw new ValidationError("Task title must be 200 characters or less.");
    }

    // Validate status
    const validStatuses: KanbanStatus[] = [
      "todo",
      "doing",
      "done",
    ];

    const status: KanbanStatus =
      data.status === undefined
        ? "todo"
        : validStatuses.includes(data.status as KanbanStatus)
          ? (data.status as KanbanStatus)
          : (() => {
              throw new ValidationError("Invalid Kanban status.");
            })();

    // Validate priority
    const validPriorities: KanbanPriority[] = [
      "low",
      "medium",
      "high",
    ];

    const priority: KanbanPriority =
      data.priority === undefined
        ? "medium"
        : validPriorities.includes(data.priority as KanbanPriority)
          ? (data.priority as KanbanPriority)
          : (() => {
              throw new ValidationError("Invalid task priority.");
            })();

    // Validate optional fields
    const optionalString = (
      value: unknown,
      field: string,
    ): string | undefined => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }

      if (typeof value !== "string") {
        throw new ValidationError(`Invalid ${field}.`);
      }

      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    };

    const description = optionalString(
      data.description,
      "description",
    );

    const dueDate = optionalString(data.dueDate, "dueDate");
    const assigneeId = optionalString(
      data.assigneeId,
      "assigneeId",
    );

    const imageUrl = optionalString(data.imageUrl, "imageUrl");
    const imagePath = optionalString(data.imagePath, "imagePath");

    let categoryId: number | undefined;

    if (data.categoryId !== undefined && data.categoryId !== null) {
      categoryId = Number(data.categoryId);

      if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
        throw new ValidationError("Invalid category ID.");
      }
    }

    let labels: string[] | undefined;

    if (data.labels !== undefined && data.labels !== null) {
      if (
        !Array.isArray(data.labels) ||
        !data.labels.every((label) => typeof label === "string")
      ) {
        throw new ValidationError("Invalid task labels.");
      }

      labels = data.labels.map((label: string) => label.trim());
    }

    console.info("[Kanban] Creating task:", {
      profileId,
      title,
      status,
      priority,
    });

    const task = await createKanbanTask(profileId, {
      title,
      description,
      status,
      categoryId,
      labels,
      dueDate,
      priority,
      assigneeId,
      imageUrl,
      imagePath,
    });

    console.info("[Kanban] Task created successfully:", task);

    return jsonOk({ task }, 201);
  });
}
