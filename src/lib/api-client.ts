import type { AchievementProgress, Category, DailyCheckin, DailyQuest, DirectMessage, FocusSession, FriendRequest, FriendSummary, Goal, GroupDetail, GroupMessage, GroupSummary, Insight, KanbanLabel, KanbanTask, LeagueSnapshot, Metric, PublicProfile, QuestProgressWithQuest, Task, User, UserDailyTask, UserSearchResult, UserSettings, UserXP, WeeklyPlan } from "@/types";
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

export class ApiRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
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
    throw new ApiRequestError(body.error || "Não foi possível concluir a solicitação.", response.status);
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
  updatePhotoUrl: (photoUrl: string) =>
    request<{ user: User }>("/api/profile", { method: "PATCH", body: JSON.stringify({ photoUrl }) }),

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
  createTask: (input: { title: string; categoryId?: number; dueDate?: string }) =>
    request<{ task: Task }>("/api/tasks", { method: "POST", body: JSON.stringify(input) }),
  updateTask: (id: number, patch: { title?: string; categoryId?: number; dueDate?: string }) =>
    request<{ task: Task }>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  setTaskCompleted: (id: number, completed: boolean) =>
    request<{ task: Task }>(`/api/tasks/${id}/complete`, { method: "POST", body: JSON.stringify({ completed }) }),
  deleteTask: (id: number) => request<{ ok: true }>(`/api/tasks/${id}`, { method: "DELETE" }),

  // Metas e hábitos
  getGoals: () => request<Array<{ goal: GoalWithProgress; habits: HabitWithCompletion[] }>>("/api/goals"),
  createGoal: (input: { title: string; categoryId?: number; targetValue: number; frequency: GoalFrequency }) =>
    request<{ goal: GoalWithProgress }>("/api/goals", { method: "POST", body: JSON.stringify(input) }),
  updateGoal: (id: number, patch: { title?: string; categoryId?: number; targetValue?: number; currentValue?: number; frequency?: GoalFrequency }) =>
    request<{ goal: GoalWithProgress }>(`/api/goals/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteGoal: (id: number) => request<{ ok: true }>(`/api/goals/${id}`, { method: "DELETE" }),
  createHabit: (goalId: number, input: { title: string; frequency: HabitFrequency }) =>
    request<{ habit: HabitWithCompletion }>(`/api/goals/${goalId}/habits`, { method: "POST", body: JSON.stringify(input) }),
  updateHabit: (id: number, patch: { title?: string; active?: boolean; frequency?: HabitFrequency }) =>
    request<{ habit: HabitWithCompletion }>(`/api/habits/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  setHabitCompletion: (id: number, completed: boolean, date?: string) =>
    request<HabitCompletionResult>(`/api/habits/${id}/completions`, { method: "POST", body: JSON.stringify({ completed, date }) }),
  deleteHabit: (id: number) => request<{ ok: true }>(`/api/habits/${id}`, { method: "DELETE" }),

  // Categorias (compartilhadas entre metas, tarefas, Kanban e plano semanal)
  getCategories: () => request<{ categories: Category[] }>("/api/categories"),
  createCategory: (input: { name: string; color: string; icon?: string | null }) =>
    request<{ category: Category }>("/api/categories", { method: "POST", body: JSON.stringify(input) }),
  updateCategory: (id: number, patch: { name?: string; color?: string; icon?: string | null }) =>
    request<{ category: Category }>(`/api/categories/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteCategory: (id: number) =>
    request<{ ok: true; affected: number }>(`/api/categories/${id}`, { method: "DELETE" }),

  // Configurações
  getSettings: () => request<UserSettings>("/api/settings"),
  saveSettings: (input: Partial<Omit<UserSettings, "profileId">>) =>
    request<UserSettings>("/api/settings", { method: "PUT", body: JSON.stringify(input) }),

  // Insights
  getInsights: (weekStart?: string) => request<{ insights: Insight[] }>(`/api/insights${weekStart ? `?weekStart=${weekStart}` : ""}`),
  regenerateInsights: () => request<{ insights: Insight[] }>("/api/insights", { method: "POST" }),

  // Kanban
  getKanban: () => request<{ tasks: KanbanTask[]; labels: KanbanLabel[] }>("/api/kanban"),
  createKanbanTask: (input: { title: string; description?: string; status?: "todo" | "doing" | "done"; categoryId?: number; labels?: string[]; dueDate?: string; priority?: "low" | "medium" | "high"; assigneeId?: string }) =>
    request<{ task: KanbanTask }>("/api/kanban", { method: "POST", body: JSON.stringify(input) }),
  updateKanbanTask: (id: number, patch: { title?: string; description?: string | null; status?: "todo" | "doing" | "done"; categoryId?: number; position?: number; labels?: string[]; dueDate?: string | null; priority?: "low" | "medium" | "high"; assigneeId?: string | null }) =>
    request<{ task: KanbanTask }>(`/api/kanban/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteKanbanTask: (id: number) => request<{ ok: true }>(`/api/kanban/${id}`, { method: "DELETE" }),
  moveKanbanTask: (taskId: number, newStatus: "todo" | "doing" | "done", newPosition: number) =>
    request<{ task: KanbanTask }>("/api/kanban/move", { method: "POST", body: JSON.stringify({ taskId, newStatus, newPosition }) }),
  promoteTaskToKanban: (taskId: number) =>
    request<{ task: KanbanTask }>("/api/kanban/promote", { method: "POST", body: JSON.stringify({ taskId }) }),
  // Labels
  getKanbanLabels: () => request<{ labels: KanbanLabel[] }>("/api/kanban/labels"),
  createKanbanLabel: (input: { name: string; color: string }) =>
    request<{ label: KanbanLabel }>("/api/kanban/labels", { method: "POST", body: JSON.stringify(input) }),
  deleteKanbanLabel: (id: number) =>
    request<{ ok: true }>(`/api/kanban/labels/${id}`, { method: "DELETE" }),

  // Weekly Plans
  getWeeklyPlans: (weekStart?: string) => {
    const params = weekStart ? `?weekStart=${weekStart}` : "";
    return request<WeeklyPlan[]>(`/api/weekly-plans${params}`);
  },
  createWeeklyPlan: (input: { planDate: string; title: string; categoryId?: number; taskId?: number }) =>
    request<{ plan: WeeklyPlan }>("/api/weekly-plans", { method: "POST", body: JSON.stringify(input) }),
  completeWeeklyPlan: (id: number) =>
    request<{ plan: WeeklyPlan }>(`/api/weekly-plans/${id}`, { method: "PATCH" }),
  setWeeklyPlanCompleted: (id: number, completed: boolean) =>
    request<{ plan: WeeklyPlan }>(`/api/weekly-plans/${id}`, { method: "PATCH", body: JSON.stringify({ completed }) }),
  updateWeeklyPlan: (id: number, input: { title: string; categoryId: number; planDate: string }) =>
    request<{ plan: WeeklyPlan }>(`/api/weekly-plans/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteWeeklyPlan: (id: number) => request<{ ok: true }>(`/api/weekly-plans/${id}`, { method: "DELETE" }),

  // Focus
  getFocusData: () => request<{ history: FocusSession[]; todayStats: { minutesFocused: number; coinsEarned: number }; xp: UserXP }>("/api/focus"),
  startFocus: (targetDurationMinutes: number, taskId?: number, energyType?: string) =>
    request<{ session: FocusSession }>("/api/focus", { method: "POST", body: JSON.stringify({ action: "start", targetDurationMinutes, taskId, energyType }) }),
  endFocus: (sessionId: number, focusedSeconds: number, isRoomSession: boolean = false) =>
    request<{ session: FocusSession; xpAwarded: number; questsUpdated: number }>("/api/focus", { method: "POST", body: JSON.stringify({ action: "end", sessionId, focusedSeconds, isRoomSession }) }),

  // Garden (Meu Jardim)
  getGarden: () => request<{ entries: import("@/lib/db/focus").GardenEntry[] }>("/api/garden"),
  importGarden: (entries: import("@/lib/db/focus").ImportGardenEntry[]) =>
    request<{ imported: number }>("/api/garden", { method: "POST", body: JSON.stringify({ entries }) }),

  // Daily Quests
  getDailyQuests: (date?: string) => request<{ quests: QuestProgressWithQuest[]; date: string }>(`/api/daily-quests${date ? `?date=${date}` : ''}`),
  claimQuestReward: (questProgressId: number) => request<{ coinsAwarded: number; quest: DailyQuest; message: string }>(`/api/daily-quests/${questProgressId}`, { method: "POST" }),

  // Daily Tasks (user-written, reset daily)
  getDailyTasks: () => request<{ tasks: UserDailyTask[]; date: string }>("/api/daily-tasks"),
  createDailyTask: (title: string) =>
    request<{ task: UserDailyTask; date: string }>("/api/daily-tasks", { method: "POST", body: JSON.stringify({ title }) }),
  toggleDailyTask: (id: number, completed: boolean) =>
    request<{ task: UserDailyTask; xpAwarded: number; coinsAwarded: number; message?: string }>(`/api/daily-tasks/${id}`, { method: "PATCH", body: JSON.stringify({ completed }) }),
  deleteDailyTask: (id: number) =>
    request<{ ok: boolean }>(`/api/daily-tasks/${id}`, { method: "DELETE" }),

  // Env / config status (diagnostic: masked values, never full secrets)
  getEnvStatus: () => request<{ groups: { label: string; vars: { key: string; set: boolean; value: string | null }[] }[]; allSet: boolean }>("/api/env-status"),

  // Focus Rooms
  createFocusRoom: (durationMinutes: number, energyType?: string) =>
    request<{ room: import("@/lib/db/focus-rooms").FocusRoom }>("/api/focus-rooms", { method: "POST", body: JSON.stringify({ durationMinutes, energyType }) }),
  getFocusRooms: () => request<{ rooms: import("@/lib/db/focus-rooms").FocusRoom[] }>("/api/focus-rooms"),
  getFocusRoomById: (id: number) => request<{ room: import("@/lib/db/focus-rooms").FocusRoom }>(`/api/focus-rooms/${id}`),
  getFocusRoomByCode: (code: string) => request<{ room: import("@/lib/db/focus-rooms").FocusRoom }>(`/api/focus-rooms/${code}`),
  joinFocusRoom: (code: string, energyType?: string) =>
    request<{ room: import("@/lib/db/focus-rooms").FocusRoom; message: string }>(`/api/focus-rooms/${code}/join`, { method: "POST", body: JSON.stringify({ energyType }) }),
  startFocusRoom: (roomId: number) =>
    request<{ room: import("@/lib/db/focus-rooms").FocusRoom; message: string }>(`/api/focus-rooms/${roomId}/start`, { method: "POST" }),
  pauseFocusRoom: (roomId: number) =>
    request<{ room: import("@/lib/db/focus-rooms").FocusRoom; message: string }>(`/api/focus-rooms/${roomId}/pause`, { method: "POST" }),
  resumeFocusRoom: (roomId: number) =>
    request<{ room: import("@/lib/db/focus-rooms").FocusRoom; message: string }>(`/api/focus-rooms/${roomId}/resume`, { method: "POST" }),
  stopFocusRoom: (roomId: number) =>
    request<{ room: import("@/lib/db/focus-rooms").FocusRoom; message: string }>(`/api/focus-rooms/${roomId}/stop`, { method: "POST" }),
  endFocusRoom: (roomId: number) =>
    request<{ room: import("@/lib/db/focus-rooms").FocusRoom; message: string }>(`/api/focus-rooms/${roomId}`, { method: "PATCH" }),
  leaveFocusRoom: (roomId: number) =>
    request<{ message: string }>(`/api/focus-rooms/${roomId}/leave`, { method: "DELETE" }),
  selectEnergy: (roomId: number, energyType: string) =>
    request<{ room: import("@/lib/db/focus-rooms").FocusRoom; message: string }>(`/api/focus-rooms/${roomId}/select-energy`, { method: "POST", body: JSON.stringify({ energyType }) }),
  updateRoomDuration: (roomId: number, durationMinutes: number) =>
    request<{ room: import("@/lib/db/focus-rooms").FocusRoom; message: string }>(`/api/focus-rooms/${roomId}/update-duration`, { method: "POST", body: JSON.stringify({ durationMinutes }) }),
  deleteFocusRoom: (roomId: number) =>
    request<{ ok: true; message: string }>(`/api/focus-rooms/${roomId}`, { method: "DELETE" }),
  giveUpFocusRoom: (roomId: number) =>
    request<{ room: import("@/lib/db/focus-rooms").FocusRoom; message: string }>(`/api/focus-rooms/${roomId}/give-up`, { method: "POST" }),
  completeFocusRoom: (roomId: number) =>
    request<{ room: import("@/lib/db/focus-rooms").FocusRoom | null; message: string }>(`/api/focus-rooms/${roomId}/complete`, { method: "POST" }),
  cleanupFocusRooms: () =>
    request<{ ok: true; expired: number; deleted: number }>("/api/focus-rooms/cleanup", { method: "POST" }),

  // Social
  getUnreadCounts: () => request<{ hasUnread: boolean; dmUnread: number; groupUnread: number }>("/api/social/unread"),
  searchUsers: (q: string) => request<{ results: UserSearchResult[] }>(`/api/social/search?q=${encodeURIComponent(q)}`),
  getPublicProfile: (id: string) => request<{ profile: PublicProfile }>(`/api/social/profile/${id}`),
  getUserByUsername: (username: string) => request<{ user: import("@/types").UserProfileForChat }>(`/api/social/username/${username}`),

  // Friends
  getFriends: () => request<{ friends: FriendSummary[] }>("/api/friends"),
  sendFriendRequest: (addresseeId: string) =>
    request<{ status: "pending" | "accepted" }>("/api/friends", { method: "POST", body: JSON.stringify({ addresseeId }) }),
  getFriendRequests: () => request<{ requests: FriendRequest[] }>("/api/friends/requests"),
  acceptFriendRequest: (id: number) =>
    request<{ ok: true }>(`/api/friends/${id}`, { method: "PATCH" }),
  declineFriendRequest: (id: number) =>
    request<{ ok: true }>(`/api/friends/${id}`, { method: "DELETE" }),

  // DMs
  getMessages: (friendId: string, afterId?: number) => {
    const query = afterId ? `?after=${afterId}` : "";
    return request<{ messages: DirectMessage[] }>(`/api/dm/${friendId}${query}`);
  },
  sendMessage: (friendId: string, body: string) =>
    request<{ message: DirectMessage }>(`/api/dm/${friendId}`, { method: "POST", body: JSON.stringify({ body }) }),
  markDmRead: (friendId: string) =>
    request<{ ok: true }>(`/api/dm/${friendId}/read`, { method: "POST" }),
  startChatByUsername: (username: string) =>
    request<import("@/types").StartChatResult>(`/api/dm/by-username?username=${encodeURIComponent(username)}`),
  sendMessageByUsername: (username: string, body: string) =>
    request<{ message: DirectMessage }>(`/api/dm/by-username?username=${encodeURIComponent(username)}`, { method: "POST", body: JSON.stringify({ body }) }),

  // Groups
  getGroups: () => request<{ groups: GroupSummary[] }>("/api/groups"),
  createGroup: (input: { name: string; avatarEmoji?: string; inviteIds?: string[] }) =>
    request<{ group: GroupDetail }>("/api/groups", { method: "POST", body: JSON.stringify(input) }),
  createGroupWithUsernames: (input: { name: string; avatarEmoji?: string; description?: string; isPublic?: boolean; memberUsernames?: string[] }) =>
    request<{ group: GroupDetail }>("/api/groups/create-with-usernames", { method: "POST", body: JSON.stringify(input) }),
  getGroup: (id: number) => request<{ group: GroupDetail }>(`/api/groups/${id}`),
  getGroupMessages: (id: number, afterId?: number) => {
    const query = afterId ? `?after=${afterId}` : "";
    return request<{ messages: GroupMessage[] }>(`/api/groups/${id}/messages${query}`);
  },
  sendGroupMessage: (id: number, body: string) =>
    request<{ message: GroupMessage }>(`/api/groups/${id}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
  markGroupRead: (id: number) =>
    request<{ ok: true }>(`/api/groups/${id}/read`, { method: "POST" }),
  getGroupLeaderboard: (id: number) =>
    request<{ leaderboard: import("@/types").LeagueEntry[] }>(`/api/groups/${id}/leaderboard`),
  getGlobalGroupsLeaderboard: (period: "WEEK" | "MONTH" | "YEAR" | "ALL_TIME", limit = 50, offset = 0) =>
    request<{ entries: import("@/lib/db/group-leaderboard").GroupLeaderboardEntry[]; userGroupIds: number[] }>(
      `/api/groups/leaderboard?period=${period}&limit=${limit}&offset=${offset}`
    ),
  getGroupMemberContributions: (id: number, period: "WEEK" | "MONTH" | "YEAR" | "ALL_TIME") =>
    request<{ members: import("@/lib/db/group-leaderboard").MemberContribution[]; groupTotal: number }>(
      `/api/groups/${id}/contributions?period=${period}`
    ),
  getGroupMilestones: (id: number) =>
    request<{ milestones: import("@/lib/db/group-milestones").GroupMilestoneStatus[]; totalMinutes: number }>(
      `/api/groups/${id}/milestones`
    ),
  getGroupWeeklyQuest: (id: number) =>
    request<{ quest: import("@/lib/db/group-milestones").GroupWeeklyQuestStatus }>(`/api/groups/${id}/weekly-quest`),
  claimGroupWeeklyQuest: (id: number) =>
    request<{ coinsAwarded: number }>(`/api/groups/${id}/weekly-quest`, { method: "POST" }),

  // League
  getLeague: () => request<{ snapshot: LeagueSnapshot }>("/api/league"),
  getLeagueNew: () => request<import("@/lib/db/league-new").LeagueNewSnapshot>("/api/league-new"),

  // Achievements
  getAchievements: () => request<{ achievements: AchievementProgress[] }>("/api/achievements"),
  markAchievementSeen: (achievementId: string) =>
    request<{ ok: true }>("/api/achievements", { method: "POST", body: JSON.stringify({ achievementId }) }),
  toggleFeaturedAchievement: (achievementId: string) =>
    request<{ isFeatured: boolean; featuredOrder?: number }>("/api/achievements", { method: "PATCH", body: JSON.stringify({ achievementId }) }),

  // Store
  getStore: () => request<{ items: import("@/types").StoreItem[]; balance: number; banner: { hasCustomBanner: boolean; bannerImageUrl: string | null; unlocked: boolean }; shieldCount: number; ownedAuras: string[] }>("/api/store"),
  purchaseDecoration: (decorationId: string) =>
    request<{ balance: number }>("/api/store/decorations", { method: "POST", body: JSON.stringify({ decorationId }) }),
  equipDecoration: (decorationId: string | null) =>
    request<{ ok: true }>("/api/store/decorations", { method: "PATCH", body: JSON.stringify({ decorationId }) }),
  purchaseAura: (auraType: string) =>
    request<{ balance: number }>("/api/store/auras", { method: "POST", body: JSON.stringify({ auraType }) }),
  unlockBanner: () =>
    request<{ balance: number }>("/api/store/banner", { method: "POST", body: JSON.stringify({ action: "unlock" }) }),
  updateBannerImage: (imageUrl: string) =>
    request<{ ok: true }>("/api/store/banner", { method: "POST", body: JSON.stringify({ action: "update", imageUrl }) }),
  purchaseShield: () =>
    request<{ balance: number; shieldCount: number }>("/api/store/shields", { method: "POST" }),
  getXpBoost: () =>
    request<{ quantity: number; itemType: string; boost: import("@/types").ActiveXPBoost | null }>("/api/store/xp-boost"),
  purchaseXpBoost: () =>
    request<{ balance: number; quantity: number }>("/api/store/xp-boost", { method: "POST" }),
  activateXpBoost: () =>
    request<{ boost: import("@/types").ActiveXPBoost; extended: boolean; quantity: number }>("/api/store/xp-boost/activate", { method: "POST" }),
  getRecaps: () => request<{ recaps: import("@/types").MonthlyRecap[] }>("/api/recap"),
  generateRecap: (month: string) =>
    request<{ recap: import("@/types").MonthlyRecap }>("/api/recap", { method: "POST", body: JSON.stringify({ month }) }),

};
