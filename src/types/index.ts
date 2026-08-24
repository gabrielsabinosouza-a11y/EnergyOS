export type TaskCategory = "FOCO" | "CORPO" | "MENTE" | "ORDEM" | "ENERGIA";
export type GoalCategory = "sono" | "estudo" | "treino" | "saude" | "foco";

export interface User {
  id: string;
  displayName: string;
  email: string;
  photoUrl?: string;
  createdAt: string;
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

export function getTaskProgress(tasks: Array<Pick<Task, "completedAt"> & { done?: boolean }>) {
  if (tasks.length === 0) return { completed: 0, total: 0, percentage: 0, streakQualified: false };

  const completed = tasks.filter((task) => Boolean(task.completedAt) || task.done === true).length;
  const percentage = Math.round((completed / tasks.length) * 100);
  return { completed, total: tasks.length, percentage, streakQualified: percentage >= 50 };
}
