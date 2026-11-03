export type DashboardTask = {
  id: number;
  title: string;
  dueDate: string;
  completedAt?: string;
  startTime?: string;
  endTime?: string;
};

export type DashboardCheckin = {
  id: number;
  checkinDate: string;
  sleepHours?: number;
  studyMinutes?: number;
  trainingMinutes?: number;
  energyScore?: number;
};

export type DashboardSnapshot = {
  tasks: DashboardTask[];
  checkins: DashboardCheckin[];
  taskProgress: {
    completed: number;
    total: number;
    percentage: number;
    streakQualified: boolean;
  };
  streak: {
    currentStreak: number;
    longestStreak: number;
    todayQualified: boolean;
    todayTotal: number;
    todayStatus?: 'success' | 'protected' | 'lost' | null;
    yesterdayStatus?: 'success' | 'protected' | 'lost' | null;
    shieldCount: number;
  };
  weeklyFocusMinutes: number;
};

export type CheckinResponse = {
  checkin: DashboardCheckin;
  xpAwarded: number;
  coinsAwarded: number;
};

export type DailyHabit = {
  id: number;
  title: string;
  taskDate: string;
  isCompleted: boolean;
  dailyTarget: number;
  completedCount: number;
};

export type DailyHabitsResponse = {
  tasks: DailyHabit[];
  date: string;
};

export type DailyHabitCreateResponse = {
  task: DailyHabit;
  date: string;
};

export type DailyHabitProgressResponse = {
  task: DailyHabit;
  xpAwarded: number;
  coinsAwarded: number;
};
