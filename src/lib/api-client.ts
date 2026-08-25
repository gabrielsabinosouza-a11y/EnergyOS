import type { DailyCheckin, FocusSession, Goal, Insight, KanbanTask, Metric, Task, TaskCategory, User, UserSettings, UserXP, WeeklyPlan } from "@/types";
import type { GoalFrequency } from "@/lib/db/goals";
import type { HabitFrequency, HabitWithCompletion } from "@/lib/db/habits";
import type { GoalWithProgress } from "@/lib/db/goals";
import type { StreakInfo, TaskProgress } from "@/lib/db/tasks";

export interface DashboardSnapshot {
  user: User;
  tasks: Task[];
  checkins: DailyCheckin[];
  metrics: Metric[];
  insights: Insight[];
  taskProgress: TaskProgress;
  streak?: StreakInfo;
}

export interface ApiError {
  error: string;
  details?: Record<string, string>;
}

async function authToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const { auth } = await import("@/lib/firebase");
  return auth?.currentUser?.getIdToken() ?? null;
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const token = await authToken();
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiError;
    throw new Error(body.error || "Não foi possível concluir a solicitação.");
  }
  return response.json() as Promise<T>;
}

export interface TaskBundle {
  date: string;
  tasks: Task[];
  progress: TaskProgress;
}

export interface CheckinInput {
  checkinDate?: string;
  sleepHours?: number;
  studyMinutes?: number;
  trainingMinutes?: number;
  energyScore?: number;
}

export interface HabitCompletionResult {
  habitId: number;
  date: string;
  completed: boolean;
}

export const api = {
  // Dashboard
  getDashboard: () => request<DashboardSnapshot>("/api/dashboard"),

  // Perfil
  getProfile: () => request<{ user: User }>("/api/profile"),
  updateDisplayName: (displayName: string) =>
    request<{ user: User }>("/api/profile", { method: "PATCH", body: JSON.stringify({ displayName }) }),

  // Check-ins
  getCheckins: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    return request<{ checkins: DailyCheckin[] }>(`/api/checkins${query ? `?${query}` : ""}`);
  },
  saveCheckin: (input: CheckinInput) => request<DailyCheckin>("/api/checkins", { method: "POST", body: JSON.stringify(input) }),

  // Tarefas
  getTasks: (date?: string) => request<TaskBundle>(`/api/tasks${date ? `?date=${date}` : ""}`),
  createTask: (input: { title: string; category: TaskCategory; dueDate?: string }) =>
    request<{ task: Task }>("/api/tasks", { method: "POST", body: JSON.stringify(input) }),
  updateTask: (id: number, patch: { title?: string; category?: TaskCategory; dueDate?: string }) =>
    request<{ task: Task }>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  setTaskCompleted: (id: number, completed: boolean) =>
    request<{ task: Task }>(`/api/tasks/${id}/complete`, { method: "POST", body: JSON.stringify({ completed }) }),
  deleteTask: (id: number) => request<{ ok: true }>(`/api/tasks/${id}`, { method: "DELETE" }),

  // Metas e hábitos
  getGoals: () => request<Array<{ goal: GoalWithProgress; habits: HabitWithCompletion[] }>>("/api/goals"),
  createGoal: (input: { title: string; category: Goal["category"]; targetValue: number; frequency: GoalFrequency }) =>
    request<{ goal: GoalWithProgress }>("/api/goals", { method: "POST", body: JSON.stringify(input) }),
  updateGoal: (id: number, patch: { title?: string; category?: Goal["category"]; targetValue?: number; currentValue?: number; frequency?: GoalFrequency }) =>
    request<{ goal: GoalWithProgress }>(`/api/goals/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteGoal: (id: number) => request<{ ok: true }>(`/api/goals/${id}`, { method: "DELETE" }),
  createHabit: (goalId: number, input: { title: string; frequency: HabitFrequency }) =>
    request<{ habit: HabitWithCompletion }>(`/api/goals/${goalId}/habits`, { method: "POST", body: JSON.stringify(input) }),
  updateHabit: (id: number, patch: { title?: string; active?: boolean; frequency?: HabitFrequency }) =>
    request<{ habit: HabitWithCompletion }>(`/api/habits/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  setHabitCompletion: (id: number, completed: boolean, date?: string) =>
    request<HabitCompletionResult>(`/api/habits/${id}/completions`, { method: "POST", body: JSON.stringify({ completed, date }) }),
  deleteHabit: (id: number) => request<{ ok: true }>(`/api/habits/${id}`, { method: "DELETE" }),

  // Configurações
  getSettings: () => request<UserSettings>("/api/settings"),
  saveSettings: (input: Partial<Omit<UserSettings, "profileId">>) =>
    request<UserSettings>("/api/settings", { method: "PUT", body: JSON.stringify(input) }),

  // Insights
  getInsights: (weekStart?: string) => request<{ insights: Insight[] }>(`/api/insights${weekStart ? `?weekStart=${weekStart}` : ""}`),
  regenerateInsights: () => request<{ insights: Insight[] }>("/api/insights", { method: "POST" }),

  // Kanban
  getKanban: () => request<KanbanTask[]>("/api/kanban"),
  createKanbanTask: (input: { title: string; description?: string; status?: "todo" | "doing" | "done"; category?: KanbanTask["category"] }) =>
    request<{ task: KanbanTask }>("/api/kanban", { method: "POST", body: JSON.stringify(input) }),
  updateKanbanTask: (id: number, patch: { title?: string; description?: string | null; status?: "todo" | "doing" | "done"; category?: KanbanTask["category"]; position?: number }) =>
    request<{ task: KanbanTask }>(`/api/kanban/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteKanbanTask: (id: number) => request<{ ok: true }>(`/api/kanban/${id}`, { method: "DELETE" }),
  promoteTaskToKanban: (taskId: number) =>
    request<{ task: KanbanTask }>("/api/kanban/promote", { method: "POST", body: JSON.stringify({ taskId }) }),

  // Weekly Plans
  getWeeklyPlans: (weekStart?: string) => {
    const params = weekStart ? `?weekStart=${weekStart}` : "";
    return request<WeeklyPlan[]>(`/api/weekly-plans${params}`);
  },
  createWeeklyPlan: (input: { planDate: string; title: string; category?: TaskCategory; taskId?: number }) =>
    request<{ plan: WeeklyPlan }>("/api/weekly-plans", { method: "POST", body: JSON.stringify(input) }),
  completeWeeklyPlan: (id: number) =>
    request<{ plan: WeeklyPlan }>(`/api/weekly-plans/${id}`, { method: "PATCH" }),
  deleteWeeklyPlan: (id: number) => request<{ ok: true }>(`/api/weekly-plans/${id}`, { method: "DELETE" }),

  // Focus
  getFocusData: () => request<{ history: FocusSession[]; todayBlocks: { blocks: number; xpEarned: number }; xp: UserXP }>("/api/focus"),
  startFocus: (taskId?: number) =>
    request<{ session: FocusSession }>("/api/focus", { method: "POST", body: JSON.stringify({ action: "start", taskId }) }),
  endFocus: (sessionId: number) =>
    request<{ session: FocusSession; xpAwarded: number }>("/api/focus", { method: "POST", body: JSON.stringify({ action: "end", sessionId }) }),
};
