export type TaskCategory = "FOCO" | "CORPO" | "MENTE" | "ORDEM" | "ENERGIA";
export type GoalCategory = "sono" | "estudo" | "treino" | "saude" | "foco";
export type MetricKind = "sleep" | "study" | "training" | "energy" | "tasks";

export interface User {
  id: string;
  displayName: string;
  email: string;
  photoUrl?: string;
  username?: string;
  createdAt: string;
  lastActiveAt?: string;
  currentStreak?: number;
  longestStreak?: number;
}

export type FriendshipStatus = "pending" | "accepted";
export type LeagueTier = "faisca" | "chama" | "aura" | "nucleo";
export type LeagueResult = "promoted" | "demoted" | "stayed";

export interface PublicProfile {
  id: string;
  displayName: string;
  username?: string;
  photoUrl?: string;
  lastActiveAt?: string;
  currentStreak: number;
  longestStreak: number;
  weeklyFocusMinutes: number;
  achievements: AchievementProgress[];
}

export interface FriendSummary {
  id: string;
  displayName: string;
  username?: string;
  photoUrl?: string;
  lastActiveAt?: string;
  currentStreak: number;
  friendshipId: number;
  unreadCount: number;
}

export interface FriendRequest {
  id: number;
  direction: "incoming" | "outgoing";
  createdAt: string;
  user: {
    id: string;
    displayName: string;
    username?: string;
    photoUrl?: string;
  };
}

export interface UserSearchResult {
  id: string;
  displayName: string;
  username?: string;
  photoUrl?: string;
  relation: "none" | "pending_outgoing" | "pending_incoming" | "friends";
}

export interface DirectMessage {
  id: number;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
}

export interface GroupSummary {
  id: number;
  name: string;
  avatarEmoji: string;
  avatarUrl?: string;
  memberCount: number;
  weeklyFocusMinutes: number;
  unreadCount: number;
}

export interface GroupMember {
  id: string;
  displayName: string;
  username?: string;
  photoUrl?: string;
  role: "owner" | "member";
  currentStreak: number;
}

export interface GroupDetail {
  id: number;
  name: string;
  avatarEmoji: string;
  avatarUrl?: string;
  createdBy: string;
  createdAt: string;
  members: GroupMember[];
  weeklyFocusMinutes: number;
}

export interface GroupMessage {
  id: number;
  groupId: number;
  senderId: string;
  senderName: string;
  senderPhotoUrl?: string;
  body: string;
  createdAt: string;
}

export interface LeagueEntry {
  profileId: string;
  displayName: string;
  username?: string;
  photoUrl?: string;
  xp: number;
  rank: number;
  currentStreak: number;
  isCurrentUser: boolean;
  isFriend: boolean;
}

export interface LeagueSnapshot {
  tier: LeagueTier;
  weekStart: string;
  resetsAt: string;
  entries: LeagueEntry[];
  promotionUntilRank: number | null;
  demotionFromRank: number | null;
  lastWeekResult?: LeagueResult;
  lastWeekRank?: number;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  category: string;
  thresholds: number[];
}

export interface AchievementProgress {
  id: string;
  title: string;
  description: string;
  category: string;
  thresholds: number[];
  currentValue: number;
  unlockedTier: number;
  justUnlocked: boolean;
  unlockedAt?: string;
}

export interface Task {
  id: number;
  profileId: string;
  title: string;
  category: TaskCategory;
  dueDate: string;
  completedAt?: string;
}

export interface DailyCheckin {
  id: number;
  profileId: string;
  checkinDate: string;
  sleepHours?: number;
  studyMinutes?: number;
  trainingMinutes?: number;
  energyScore?: number;
}

export interface Goal {
  id: number;
  profileId: string;
  title: string;
  category: GoalCategory;
  targetValue: number;
  currentValue: number;
  frequency: "daily" | "weekly" | "monthly";
}

export interface Habit {
  id: number;
  goalId: number;
  title: string;
  frequency: "daily" | "weekly";
  active: boolean;
}

export interface UserSettings {
  profileId: string;
  notificationsEnabled: boolean;
  preferredTheme: "system" | "light" | "dark";
  sleepTime?: string;
  focusTime?: string;
}

export interface Metric {
  kind: MetricKind;
  label: string;
  value: number;
  unit: string;
  trend?: number;
  period: "day" | "week" | "month";
}

export interface Insight {
  id: string;
  profileId: string;
  title: string;
  description: string;
  metricKind?: MetricKind;
  createdAt: string;
}

export type KanbanStatus = "todo" | "doing" | "done";
export type KanbanCategory = "FOCO" | "CORPO" | "MENTE" | "ORDEM" | "ENERGIA";

export interface KanbanTask {
  id: number;
  profileId: string;
  title: string;
  description?: string;
  status: KanbanStatus;
  position: number;
  category: KanbanCategory;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyPlan {
  id: number;
  profileId: string;
  planDate: string;
  title: string;
  category: TaskCategory;
  taskId?: number;
  completedAt?: string;
}

export interface FocusSession {
  id: number;
  profileId: string;
  durationMinutes: number;
  targetDurationMinutes: number;
  startedAt: string;
  endedAt?: string;
  taskId?: number;
  xpEarned: number;
}

export interface UserXP {
  profileId: string;
  totalXP: number;
  level: number;
}

export interface XPLedgerEntry {
  id: number;
  profileId: string;
  source: "task" | "kanban" | "focus" | "streak_bonus";
  sourceId?: number;
  xpAmount: number;
  createdAt: string;
}

export function getTaskProgress(tasks: Array<Pick<Task, "completedAt"> & { done?: boolean }>) {
  if (tasks.length === 0) return { completed: 0, total: 0, percentage: 0, streakQualified: false };

  const completed = tasks.filter((task) => Boolean(task.completedAt) || task.done === true).length;
  const percentage = Math.round((completed / tasks.length) * 100);
  return { completed, total: tasks.length, percentage, streakQualified: percentage >= 50 };
}
