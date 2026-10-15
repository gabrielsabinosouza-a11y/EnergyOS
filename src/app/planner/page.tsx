"use client";

import { useCallback, useEffect, useState } from "react";
import type { WeeklyPlan, WeeklyPlanItem, Category } from "@/types";
import { api } from "@/lib/api-client";
import { addDays, monthRange, todayIso, weekRange } from "@/lib/planning/dates";
import { AppShell } from "@/components/app-shell";
import { useAuthRedirect } from "@/lib/auth-context";
import { PlanningToolbar } from "@/components/planning/PlanningToolbar";
import { MonthView } from "@/components/planning/MonthView";
import { WeekView } from "@/components/planning/WeekView";
import { DayView } from "@/components/planning/DayView";
import { AddTaskDialog } from "@/components/planning/AddTaskDialog";

type View = "month" | "week" | "day";

export default function PlanningPage() {
  const { user } = useAuthRedirect({ ifGuest: "/" });
  const [view, setView] = useState<View>("week");
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [tasks, setTasks] = useState<WeeklyPlanItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState<string | null>(null);

  // Load plans for the selected date's window. We fetch all plans (no weekStart
  // filter → latest 50) and filter client-side per view, so month/week/day always
  // agree on the same source of truth.
  useEffect(() => {
    if (!user) return;
    api.getWeeklyPlans()
      .then((items: WeeklyPlanItem[]) => setTasks(items))
      .catch(console.error);
  }, [user]);

  // Load categories once.
  useEffect(() => {
    if (!user) return;
    api.getCategories()
      .then((res) => setCategories(res.categories || []))
      .catch(console.error);
  }, [user]);

  const week = weekRange(selectedDate);
  const month = monthRange(selectedDate);
  const inRange = (start: string, end: string) => (p: WeeklyPlanItem) =>
    p.planDate >= start && p.planDate <= end;
  const weekTasks = tasks.filter(inRange(week.start, week.end));
  const monthTasks = tasks.filter(inRange(month.start, month.end));
  const dayTasks = tasks.filter((p) => p.planDate === selectedDate);

  const handlePrev = () => {
    if (view === "month") setSelectedDate(addMonthsWrap(selectedDate, -1));
    else if (view === "week") setSelectedDate(addDays(selectedDate, -7));
    else setSelectedDate(addDays(selectedDate, -1));
  };
  const handleNext = () => {
    if (view === "month") setSelectedDate(addMonthsWrap(selectedDate, 1));
    else if (view === "week") setSelectedDate(addDays(selectedDate, 7));
    else setSelectedDate(addDays(selectedDate, 1));
  };
  const handleToday = () => setSelectedDate(todayIso());

  const togglePlan = useCallback(async (id: number, completed: boolean): Promise<void> => {
    const plan = tasks.find((p) => p.id === id);
    if (plan && plan.seriesId !== null) {
      await api.setPlanOccurrenceCompleted(plan.seriesId, plan.planDate, completed);
      setTasks((prev) =>
        prev.map((p) =>
          p.seriesId === plan.seriesId && p.planDate === plan.planDate
            ? { ...p, completedAt: completed ? new Date().toISOString() : null, skipped: false }
            : p,
        ),
      );
      return;
    }
    const res = await api.setWeeklyPlanCompleted(id, completed);
    setTasks((prev) =>
      prev.map((p) => (p.id === id ? toItem(res.plan, categories.find((c) => c.id === p.categoryId) || categories[0]) : p)),
    );
  }, [tasks, categories]);

  const deletePlan = useCallback(async (id: number): Promise<void> => {
    await api.deleteWeeklyPlan(id);
    setTasks((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const openAdd = (date: string) => {
    setAddDate(date);
    setAddOpen(true);
  };

  return (
    <AppShell>
      <div className="panel p-4 sm:p-6">
        <PlanningToolbar
          selectedDate={selectedDate}
          view={view}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
          onViewChange={setView}
        />

        <div className="flex flex-col gap-4">
          {view === "month" && (
            <MonthView
              monthRange={month}
              plans={monthTasks}
              selectedDate={selectedDate}
              onDateSelect={(date) => {
                setSelectedDate(date);
                setView("day");
              }}
            />
          )}

          {view === "week" && (
            <WeekView
              weekRange={week}
              plans={weekTasks}
              selectedDate={selectedDate}
              onDateSelect={(date) => {
                setSelectedDate(date);
                setView("day");
              }}
              onPlanCreate={openAdd}
              onToggleCompleted={togglePlan}
              onDelete={deletePlan}
            />
          )}

          {view === "day" && (
            <DayView
              date={selectedDate}
              plans={dayTasks}
              onToggleCompleted={togglePlan}
              onDelete={deletePlan}
              onPlanCreate={openAdd}
            />
          )}
        </div>

        <AddTaskDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          planDate={addDate ?? undefined}
          onCreate={(plan) => {
            setTasks((prev) => [...prev, plan]);
            setAddOpen(false);
          }}
        />
      </div>
    </AppShell>
  );
}

function addMonthsWrap(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y!, m! - 1 + n, d!);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toItem(plan: WeeklyPlan, cat: Category | undefined): WeeklyPlanItem {
  return {
    id: plan.id,
    seriesId: null,
    planDate: plan.planDate,
    title: plan.title,
    categoryId: plan.categoryId,
    category: cat ?? ({ id: 0, userId: null, name: "", color: "#94a3b8", icon: null, isCustom: false, createdAt: "" } as Category),
    iconType: null,
    iconValue: null,
    color: cat?.color ?? null,
    note: null,
    completedAt: plan.completedAt ?? null,
    skipped: false,
    startTime: plan.startTime ?? null,
    durationMinutes: null,
    repeatType: null,
    repeatDays: null,
    isRecurring: false,
  };
}
