export type TaskCategory = "FOCO" | "CORPO" | "MENTE" | "ORDEM" | "ENERGIA";
export type GoalCategory = "sono" | "estudo" | "treino" | "saude" | "foco";

/** Categoria (padrão do sistema ou criada pelo usuário) usada por metas, tarefas, Kanban e plano semanal. */
export interface Category {
  id: number;
  userId: string | null;
  name: string;
  color: string;
  icon: string | null;
  isCustom: boolean;
  createdAt: string;
}
export type MetricKind = "sleep" | "study" | "training" | "energy" | "tasks";

export type UserRole = "user" | "admin";

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
  coinBalance?: number;
  hasCustomBanner?: boolean;
  bannerImageUrl?: string;
  equippedDecorationId?: string;
  streakShieldCount?: number;
  equippedShieldDesignId?: string;
  role?: UserRole;
}

export type FriendshipStatus = "pending" | "accepted";
export type LeagueTier = "faisca" | "chama" | "aura" | "nucleo";
export type LeagueResult = "promoted" | "demoted" | "stayed";

// New League System with Bronze/Prata/Ouro/Diamante/Lendas
export type NewLeagueTier = "BRONZE" | "PRATA" | "OURO" | "DIAMANTE" | "LENDAS";

export interface LeagueGroup {
  id: number;
  tier: NewLeagueTier;
  weekStartDate: string;
  weekEndDate: string;
  isLegendsGroup: boolean;
  createdAt: string;
}

export interface LeagueGroupMember {
  id: number;
  leagueGroupId: number;
  profileId: string;
  displayName?: string;
  profile?: {
    id: string;
    displayName: string;
    photoUrl?: string;
    username?: string;
    equippedDecorationId?: string;
  };
  weeklyXP: number;
  rank: number;
  joinedAt: string;
}

export interface NewLeagueSnapshot {
  currentTier: NewLeagueTier;
  currentGroup: LeagueGroup;
  members: LeagueGroupMember[];
  weekStart: string;
  weekEnd: string;
  resetIn: string; // "2d 3h 15m"
  isLegendsGroup: boolean;
  // For display
  promotionZoneEnd: number; // Top N ranks for promotion
  demotionZoneStart: number; // Bottom N ranks for demotion
  legendsQualificationInfo?: {
    isDiamante: boolean;
    top5FromEachDiamanteGroup: boolean;
  };
  liveCohort?: {
    title: string;
    members: LeagueGroupMember[];
  };
}

export interface CohortMember {
  profileId: string;
  displayName: string;
  photoUrl?: string;
  sessionStartTime: string;
}

export interface PublicProfile {
  id: string;
  displayName: string;
  username?: string;
  photoUrl?: string;
  role?: UserRole;
  createdAt?: string;
  lastActiveAt?: string;
  currentStreak: number;
  longestStreak: number;
  weeklyFocusMinutes: number;
  equippedDecorationId?: string;
  hasCustomBanner?: boolean;
  bannerImageUrl?: string;
  achievements: AchievementProgress[];
  featuredAchievements: AchievementProgress[];
  isFriend?: boolean;
  isOwner?: boolean;
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

export interface UserProfileForChat {
  id: string;
  displayName: string;
  username: string;
  photoUrl?: string;
}

export interface StartChatResult {
  conversationWith: UserProfileForChat;
  isFriend: boolean;
  friendRequestSent: boolean;
}

export interface DirectMessage {
  id: number;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
  replyToId?: number;
  replyToBody?: string;
  replyToSenderName?: string;
  editedAt?: string;
  reactions?: MessageReactionSummary[];
  isPinned?: boolean;
  pinnedAt?: string;
  pinnedBy?: string;
}

export interface MessageReactionSummary {
  emoji: string;
  count: number;
  userNames: string[];
  reactedByMe: boolean;
}

/* Unified message type used by the shared ChatThread component */
export interface ChatMessage {
  id: number;
  senderId: string;
  senderName?: string;
  senderPhotoUrl?: string;
  body?: string;
  messageType?: string;
  mediaUrl?: string;
  mediaDurationSeconds?: number;
  createdAt: string;
  replyToId?: number;
  replyToBody?: string;
  replyToSenderName?: string;
  editedAt?: string;
  reactions?: MessageReactionSummary[];
  isPinned?: boolean;
  pinnedAt?: string;
  pinnedBy?: string;
}

/** Convert a DirectMessage to the unified ChatMessage format */
export function dmToChatMessage(dm: DirectMessage, currentUserId: string): ChatMessage {
  return {
    id: dm.id,
    senderId: dm.senderId,
    body: dm.body,
    createdAt: dm.createdAt,
    replyToId: dm.replyToId,
    replyToBody: dm.replyToBody,
    replyToSenderName: dm.replyToSenderName,
    editedAt: dm.editedAt,
    reactions: dm.reactions,
    isPinned: dm.isPinned,
    pinnedAt: dm.pinnedAt,
    pinnedBy: dm.pinnedBy,
  };
}

/** Convert a GroupMessage to the unified ChatMessage format */
export function groupToChatMessage(gm: GroupMessage): ChatMessage {
  return {
    id: gm.id,
    senderId: gm.senderId,
    senderName: gm.senderName,
    senderPhotoUrl: gm.senderPhotoUrl,
    body: gm.body,
    messageType: gm.messageType,
    mediaUrl: gm.mediaUrl,
    mediaDurationSeconds: gm.mediaDurationSeconds,
    createdAt: gm.createdAt,
    replyToId: (gm as GroupMessage & { replyToId?: number }).replyToId,
    replyToBody: (gm as GroupMessage & { replyToBody?: string }).replyToBody,
    replyToSenderName: (gm as GroupMessage & { replyToSenderName?: string }).replyToSenderName,
    editedAt: (gm as GroupMessage & { editedAt?: string }).editedAt,
    reactions: gm.reactions,
    isPinned: gm.isPinned,
    pinnedAt: gm.pinnedAt,
    pinnedBy: gm.pinnedBy,
  };
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

export type GroupRole = "OWNER" | "ADMIN" | "MEMBER";

export interface GroupMember {
  id: string;
  displayName: string;
  username?: string;
  photoUrl?: string;
  role: GroupRole;
  currentStreak: number;
  isMuted?: boolean;
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
  description?: string;
  isPublic: boolean;
}

export type GroupMessageType = "TEXT" | "IMAGE" | "VIDEO" | "STICKER" | "AUDIO";

export interface GroupMessage {
  id: number;
  groupId: number;
  senderId: string;
  senderName: string;
  senderPhotoUrl?: string;
  body?: string;
  messageType: GroupMessageType;
  mediaUrl?: string;
  mediaDurationSeconds?: number;
  createdAt: string;
  replyToId?: number;
  replyToBody?: string;
  replyToSenderName?: string;
  editedAt?: string;
  reactions?: MessageReactionSummary[];
  isPinned?: boolean;
  pinnedAt?: string;
  pinnedBy?: string;
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
  isFeatured: boolean;
  featuredOrder?: number;
}

export interface Task {
  id: number;
  profileId: string;
  title: string;
  categoryId: number;
  category: Category;
  dueDate: string;
  completedAt?: string;
  startTime?: string;
  endTime?: string;
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
  categoryId: number;
  category: Category;
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
  coins: number;
  soundNotificationsEnabled: boolean;
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
export type KanbanPriority = "low" | "medium" | "high";

export interface KanbanLabel {
  id: number;
  name: string;
  color: string;
  profileId: string;
}

export interface KanbanTask {
  id: number;
  profileId: string;
  title: string;
  description?: string;
  status: KanbanStatus;
  position: number;
  categoryId: number;
  category: Category;
  labels: string[];
  dueDate?: string;
  priority: KanbanPriority;
  assigneeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyPlan {
  id: number;
  profileId: string;
  planDate: string;
  title: string;
  categoryId: number;
  category: Category;
  taskId?: number;
  completedAt?: string | null;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
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
  source: "task" | "kanban" | "focus" | "streak_bonus" | "achievement";
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

// ========================================
// Daily Quests System
// ========================================

export type QuestType = "SESSIONS_COUNT" | "TOTAL_MINUTES" | "ROOM_SESSION";

// Machine-readable event used to drive a mission's progress. Each trackable
// daily event maps to exactly one metric.
export type MissionMetric =
  | "SESSIONS_COMPLETED"
  | "TOTAL_MINUTES"
  | "ROOM_SESSION_COMPLETED"
  | "DISTINCT_ROOMS"
  | "TASKS_COMPLETED"
  | "STREAK_DAY"
  | "LONG_SESSION_60"
  | "HABITS_COMPLETED"
  | "EARLY_SESSION_9AM"
  | "WEEKLY_PLAN_COMPLETED"
  | "XP_EARNED";

export interface DailyQuest {
  id: number;
  title: string;
  description: string;
  type: QuestType | null;
  metric?: MissionMetric | string | null;
  targetValue: number;
  coinReward: number;
  isActive: boolean;
  createdAt: string;
}

export interface UserQuestProgress {
  id: number;
  profileId: string;
  questId: number;
  questDate: string;
  currentValue: number;
  isCompleted: boolean;
  isClaimed: boolean;
  completedAt?: string;
  claimedAt?: string;
  createdAt: string;
  quest?: DailyQuest;
}

export interface QuestProgressWithQuest extends UserQuestProgress {
  quest: DailyQuest;
}

export interface UserDailyTask {
  id: number;
  title: string;
  taskDate: string;
  isCompleted: boolean;
  completedAt?: string;
}

export type DecorationRarity = "common" | "rare" | "epic" | "legendary";

export interface AvatarDecoration {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  rarity: DecorationRarity;
  sortOrder: number;
}

export interface UserDecoration {
  decorationId: string;
  purchasedAt: string;
}

export interface StreakShieldUsage {
  id: number;
  profileId: string;
  usedOnDate: string;
  streakValueAtUse: number;
}

export type StreakDayStatus = "success" | "protected" | "lost";

export interface StreakDayLog {
  profileId: string;
  logDate: string;
  status: StreakDayStatus;
}

// First month the platform existed (recaps for earlier months are invalid).
export const ENERGYOS_LAUNCH_MONTH = "2026-08-01";

export interface MonthlyRecap {
  id: number;
  profileId: string;
  recapMonth: string;
  totalFocusMinutes: number;
  longestStreak: number;
  leagueTier?: string;
  leaguePromoted?: boolean;
  productivityTag?: string;
  gardenCount?: number;
  hasBeenShared?: boolean;
  generatedAt: string;
}

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  rarity: DecorationRarity;
  owned: boolean;
  equipped: boolean;
}

export interface StreakShieldDesign {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  iconUrl: string;
  price: number;
  rarity: DecorationRarity;
  sortOrder: number;
  isActive: boolean;
}

export interface UserStreakShieldDesign {
  profileId: string;
  shieldDesignId: string;
  purchasedAt: string;
}

export interface ActiveXPBoost {
  userId: string;
  activatedAt: string;
  expiresAt: string;
  multiplier: number;
  isActive: boolean;
}

// ── Calendar: external sync types ─────────────────────────────────────────

export interface CalendarConnection {
  id: number;
  profileId: string;
  provider: "google" | "microsoft" | "apple";
  isActive: boolean;
  calendarId?: string;
  connectedAt: string;
  lastSyncedAt?: string;
}

export interface ExternalEvent {
  id: number;
  profileId: string;
  connectionId: number;
  externalId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location?: string;
  recurrence?: string;
  lastModified?: string;
  isReadonly: boolean;
  createdAt: string;
}

export type CalendarEventSource = "weekly_plan" | "task" | "external";

export interface CalendarEvent {
  id: number;
  source: CalendarEventSource;
  sourceId: number;
  title: string;
  category?: TaskCategory;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  color: string;
  isReadonly: boolean;
}
