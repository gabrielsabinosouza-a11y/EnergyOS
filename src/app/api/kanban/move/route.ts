import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { moveKanbanTask } from "@/lib/db/kanban";
import { awardKanbanCompletion } from "@/lib/db/kanban";
import type { KanbanStatus } from "@/types";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const body = await readJsonBody(request);
    const taskId = body.taskId as number;
    const newStatus = body.newStatus as KanbanStatus;
    
    // Check if this is a transition to "done" to trigger reward
    const currentTask = await pool.query<{ status: string }>(
      `select status from kanban_tasks where profile_id = $1 and id = $2`,
      [profileId, taskId],
    );
    const wasDone = currentTask.rows[0]?.status === "done";
    const becomingDone = newStatus === "done" && !wasDone;
    
    const task = await moveKanbanTask(profileId, {
      taskId,
      newStatus,
      newPosition: body.newPosition as number,
    });
    
    let xpAwarded = 0;
    let coinsAwarded = 0;
    
    if (becomingDone) {
      const rewards = await awardKanbanCompletion(profileId, taskId);
      xpAwarded = rewards.xpAwarded;
      coinsAwarded = rewards.coinsAwarded;
    }
    
    return jsonOk({ task, xpAwarded, coinsAwarded });
  });
}
