"use client";

import { useEffect, useState, useCallback } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuthRedirect } from "@/lib/auth-context";
import type { WeeklyPlanItem, Category } from "@/types";
import { api } from "@/lib/api-client";
import { todayIso, weekStartIso, addDaysIso } from "@/lib/db/dates";
import { WeeklyPlan } from "@/components/dashboard/weekly-plan";

export default function CalendarPage() {
  const { user, loading } = useAuthRedirect({ ifGuest: "/" });
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [plans, setPlans] = useState<WeeklyPlanItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Fetch weekly plans for the current week
  useEffect(() => {
    if (!user) return;
    api.getWeeklyPlans(weekStartIso(selectedDate)).then(setPlans).catch(console.error);
  }, [selectedDate, user]);

  // Fetch categories
  useEffect(() => {
    if (!user) return;
    api.getCategories().then((res) => setCategories(res.categories)).catch(console.error);
  }, [user]);

  const handlePrev = () => setSelectedDate(addDaysIso(selectedDate, -7));
  const handleNext = () => setSelectedDate(addDaysIso(selectedDate, 7));
  const handleToday = () => setSelectedDate(todayIso());

  // Plan handlers
  const createPlan = useCallback(async (planDate: string, title: string, categoryId: number) => {
    const res = await api.createWeeklyPlan({ planDate, title, categoryId });
    const item: WeeklyPlanItem = {
      id: res.plan.id,
      seriesId: null,
      planDate: res.plan.planDate,
      title: res.plan.title,
      categoryId: res.plan.categoryId,
      category: res.plan.category,
      iconType: null,
      iconValue: null,
      color: res.plan.category.color,
      note: null,
      completedAt: res.plan.completedAt ?? null,
      skipped: false,
      startTime: res.plan.startTime ?? null,
      durationMinutes: null,
      repeatType: null,
      repeatDays: null,
      isRecurring: false,
    };
    setPlans((prev) => [...prev, item]);
  }, []);

  const updatePlan = useCallback(async (id: number, title: string, categoryId: number, planDate: string) => {
    const res = await api.updateWeeklyPlan(id, { title, categoryId, planDate });
    const item: WeeklyPlanItem = {
      id: res.plan.id,
      seriesId: null,
      planDate: res.plan.planDate,
      title: res.plan.title,
      categoryId: res.plan.categoryId,
      category: res.plan.category,
      iconType: null,
      iconValue: null,
      color: res.plan.category.color,
      note: null,
      completedAt: res.plan.completedAt ?? null,
      skipped: false,
      startTime: res.plan.startTime ?? null,
      durationMinutes: null,
      repeatType: null,
      repeatDays: null,
      isRecurring: false,
    };
    setPlans((prev) => prev.map((p) => (p.id === id ? item : p)));
  }, []);

  const togglePlanCompleted = useCallback(async (id: number, completed: boolean) => {
    const res = await api.setWeeklyPlanCompleted(id, completed);
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, completedAt: res.plan.completedAt } : p)));
  }, []);

  const deletePlan = useCallback(async (id: number) => {
    await api.deleteWeeklyPlan(id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const createPlanSeries = useCallback(async (payload: any) => {
    const res = await api.createWeeklyPlanSeries(payload);
    const item: WeeklyPlanItem = {
      id: -res.series.id,
      seriesId: res.series.id,
      planDate: payload.startDate,
      title: payload.title,
      categoryId: payload.categoryId,
      category: categories.find(c => c.id === payload.categoryId) || { id: 0, name: "", color: "#ccc", icon: null, isCustom: false, createdAt: "" },
      iconType: payload.iconType,
      iconValue: payload.iconValue,
      color: payload.color,
      note: payload.note,
      completedAt: null,
      skipped: false,
      startTime: payload.startTime,
      durationMinutes: payload.durationMinutes,
      repeatType: payload.repeatType,
      repeatDays: payload.repeatDays,
      isRecurring: true,
    };
    setPlans((prev) => [...prev, item]);
  }, [categories]);

  const updatePlanOccurrence = useCallback(async (seriesId: number, date: string, title: string, startTime: string | null) => {
    await api.updatePlanOccurrenceOverride(seriesId, date, { title, startTime });
    setPlans((prev) => prev.map((p) => (p.seriesId === seriesId && p.planDate === date ? { ...p, title, startTime } : p)));
  }, []);

  const togglePlanOccurrence = useCallback(async (seriesId: number, date: string, completed: boolean) => {
    await api.setPlanOccurrenceCompleted(seriesId, date, completed);
    setPlans((prev) => prev.map((p) => (p.seriesId === seriesId && p.planDate === date ? { ...p, completedAt: completed ? new Date().toISOString() : null } : p)));
  }, []);

  const deletePlanSeries = useCallback(async (seriesId: number) => {
    await api.deleteWeeklyPlanSeries(seriesId);
    setPlans((prev) => prev.filter((p) => p.seriesId !== seriesId));
  }, []);

  return (
    <AppShell>
      <div className="panel p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays size={20} className="text-[var(--accent)]" />
            <h1 className="text-xl font-semibold">Planejamento</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrev} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text)] hover:bg-[var(--bg-surface-hover)]">
              <ChevronLeft size={20} />
            </button>
            <button onClick={handleToday} className="flex h-9 px-3 rounded-lg border border-[var(--border-subtle)] text-[13px] font-medium text-[var(--text)] hover:bg-[var(--bg-surface-hover)]">
              Hoje
            </button>
            <button onClick={handleNext} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text)] hover:bg-[var(--bg-surface-hover)]">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        <WeeklyPlan
          plans={plans}
          categories={categories}
          onDelete={deletePlan}
          onCreate={createPlan}
          onUpdate={updatePlan}
          onToggleCompleted={togglePlanCompleted}
          onCreateSeries={createPlanSeries}
          onUpdate={() => {}}
          onUpdateOccurrenceOverride={updatePlanOccurrence}
          onToggleOccurrence={togglePlanOccurrence}
          onDeleteSeries={deletePlanSeries}
        />
      </div>
    </AppShell>
  );
}
