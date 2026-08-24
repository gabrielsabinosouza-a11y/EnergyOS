"use server";

import type { Goal, Habit, UserSettings } from "@/types";
import {
  createGoal,
  createHabit,
  deleteGoal,
  deleteHabit,
  getUserSettings,
  listGoalsWithHabits,
  saveUserSettings,
  setHabitActive,
  toggleHabitCompletion,
  updateGoal,
  updateGoalProgress,
  ensureProfile,
  type GoalWithHabits,
} from "@/lib/goals-service";
import type { HabitWithCompletion } from "@/lib/db";

function fail(error: unknown): never {
  const message = error instanceof Error ? error.message : "Erro inesperado.";
  throw new Error(message);
}

export async function fetchGoalsAction(profileId: string): Promise<GoalWithHabits[]> {
  try {
    return await listGoalsWithHabits(profileId);
  } catch (error) {
    fail(error);
  }
}

export async function registerProfileAction(profileId: string, displayName?: string): Promise<void> {
  try {
    await ensureProfile(profileId, displayName);
  } catch (error) {
    fail(error);
  }
}

export interface CreateGoalActionInput {
  title: string;
  category: Goal["category"];
  targetValue: number;
  frequency: Goal["frequency"];
}

export async function createGoalAction(profileId: string, input: CreateGoalActionInput): Promise<Goal> {
  try {
    return await createGoal(profileId, input);
  } catch (error) {
    fail(error);
  }
}

export interface UpdateGoalActionInput {
  title?: string;
  category?: Goal["category"];
  targetValue?: number;
  currentValue?: number;
  frequency?: Goal["frequency"];
}

export async function updateGoalAction(
  profileId: string,
  goalId: number,
  patch: UpdateGoalActionInput,
): Promise<Goal> {
  try {
    return await updateGoal(profileId, goalId, patch);
  } catch (error) {
    fail(error);
  }
}

export async function deleteGoalAction(profileId: string, goalId: number): Promise<void> {
  try {
    await deleteGoal(profileId, goalId);
  } catch (error) {
    fail(error);
  }
}

export async function updateGoalProgressAction(
  profileId: string,
  goalId: number,
  currentValue: number,
): Promise<Goal> {
  try {
    return await updateGoalProgress(profileId, goalId, currentValue);
  } catch (error) {
    fail(error);
  }
}

export interface CreateHabitActionInput {
  goalId: number;
  title: string;
  frequency: Habit["frequency"];
}

export async function createHabitAction(
  profileId: string,
  input: CreateHabitActionInput,
): Promise<HabitWithCompletion> {
  try {
    return await createHabit(profileId, input);
  } catch (error) {
    fail(error);
  }
}

export async function setHabitActiveAction(
  profileId: string,
  habitId: number,
  active: boolean,
): Promise<void> {
  try {
    await setHabitActive(profileId, habitId, active);
  } catch (error) {
    fail(error);
  }
}

export async function deleteHabitAction(profileId: string, habitId: number): Promise<void> {
  try {
    await deleteHabit(profileId, habitId);
  } catch (error) {
    fail(error);
  }
}

export async function toggleHabitCompletionAction(
  profileId: string,
  habitId: number,
  date: string,
): Promise<boolean> {
  try {
    return await toggleHabitCompletion(profileId, habitId, date);
  } catch (error) {
    fail(error);
  }
}

export async function saveUserSettingsAction(
  profileId: string,
  input: Parameters<typeof saveUserSettings>[1],
): Promise<UserSettings> {
  try {
    return await saveUserSettings(profileId, input);
  } catch (error) {
    fail(error);
  }
}

export async function getUserSettingsAction(profileId: string): Promise<UserSettings | null> {
  try {
    return await getUserSettings(profileId);
  } catch (error) {
    fail(error);
  }
}
