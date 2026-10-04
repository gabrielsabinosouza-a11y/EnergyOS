import { api } from "@/lib/api-client";

export function toggleDailyTaskCompletion(taskId: number, completed: boolean) {
  return api.toggleDailyTask(taskId, completed);
}
