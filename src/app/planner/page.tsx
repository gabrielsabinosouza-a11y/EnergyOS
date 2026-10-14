"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { WeeklyPlanItem, Category } from "@/types";
import { api } from "@/lib/api-client";
import { todayIso, weekStartIso, addDaysIso, getMonthRange, getWeekRange } from "@/lib/db/dates";
import { AppShell } from "@/components/app-shell";
import { useAuthRedirect } from "@/lib/auth-context";
import { CalendarToolbar } from "@/components/calendar/CalendarToolbar";
import { ViewSwitcher } from "@/components/calendar/ViewSwitcher";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { WeeklyPlan } from "@/components/dashboard/weekly-plan";

// Helper to convert API response to WeeklyPlanItem
function toWeeklyPlanItem(plan: any): WeeklyPlanItem {
  const cat = plan.category || { id: 0, userId: null, name: "", color: "#ccc", icon: null, isCustom: false, createdAt: "" };
  return {
    id: plan.id,
    seriesId: plan.seriesId ?? null,
    planDate: plan.planDate,
    title: plan.title,
    categoryId: plan.categoryId,
    category: cat,
    iconType: plan.iconType ?? null,
    iconValue: plan.iconValue ?? null,
    color: plan.color ?? cat.color,
    note: plan.note ?? null,
    completedAt: plan.completedAt ?? null,
    skipped: plan.skipped ?? false,
    startTime: plan.startTime ?? null,
    durationMinutes: plan.durationMinutes ?? null,
    repeatType: plan.repeatType ?? null,
    repeatDays: plan.repeatDays ?? null,
    isRecurring: plan.isRecurring ?? false,
  };
}

const FALLBACK_CATEGORY: Category = { id: 0, userId: null, name: "", color: "#ccc", icon: null, isCustom: false, createdAt: "" };

type CalendarView = "month" | "week" | "day";

export default function CalendarPage() {
  const { user, loading } = useAuthRedirect({ ifGuest: "/" });
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [view, setView] = useState<CalendarView>("week");
  const [plans, setPlans] = useState<WeeklyPlanItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Fetch weekly plans
  useEffect(() => {
    if (!user) return;
    api.getWeeklyPlans(weekStartIso(selectedDate))
      .then((items: any[]) => setPlans(items.map(toWeeklyPlanItem)))
      .catch(console.error);
  }, [selectedDate, user]);

  // Fetch categories
  useEffect(() => {
    if (!user) return;
    api.getCategories().then((res) => setCategories(res.categories)).catch(console.error);
  }, [user]);

  const handlePrev = () => setSelectedDate(addDaysIso(selectedDate, view === "month" ? -30 : -7));
  const handleNext = () => setSelectedDate(addDaysIso(selectedDate, view === "month" ? 30 : 7));
  const handleToday = () => setSelectedDate(todayIso());

  // Plan handlers
  const createPlan = useCallback(async (planDate: string, title: string, categoryId: number): Promise<void> => {
    const res = await api.createWeeklyPlan({ planDate, title, categoryId });
    const item = toWeeklyPlanItem(res.plan);
    setPlans((prev) => [...prev, item]);
  }, []);

  const updatePlan = useCallback(async (id: number, title: string, categoryId: number, planDate: string): Promise<void> => {
    const res = await api.updateWeeklyPlan(id, { title, categoryId, planDate });
    setPlans((prev) => prev.map((p) => (p.id === id ? toWeeklyPlanItem(res.plan) : p)));
  }, []);

  const togglePlanCompleted = useCallback(async (id: number, completed: boolean): Promise<void> => {
    const res = await api.setWeeklyPlanCompleted(id, completed);
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, completedAt: res.plan.completedAt ?? null } : p)));
  }, []);

  const deletePlan = useCallback(async (id: number): Promise<void> => {
    await api.deleteWeeklyPlan(id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const createPlanSeries = useCallback(async (payload: any): Promise<void> => {
    const res = await api.createWeeklyPlanSeries(payload);
    const cat = categories.find(c => c.id === payload.categoryId) || FALLBACK_CATEGORY;
    const item: WeeklyPlanItem = {
      id: -res.series.id, seriesId: res.series.id, planDate: payload.startDate, title: payload.title,
      categoryId: payload.categoryId, category: cat, iconType: payload.iconType, iconValue: payload.iconValue,
      color: payload.color, note: payload.note, completedAt: null, skipped: false,
      startTime: payload.startTime, durationMinutes: payload.durationMinutes,
      repeatType: payload.repeatType, repeatDays: payload.repeatDays, isRecurring: true,
    };
    setPlans((prev) => [...prev, item]);
  }, [categories]);

  const updatePlanOccurrence = useCallback(async (seriesId: number, date: string, title: string, startTime: string | null): Promise<void> => {
    await api.updatePlanOccurrenceOverride(seriesId, date, { title, startTime });
    setPlans((prev) => prev.map((p) => (p.seriesId === seriesId && p.planDate === date ? { ...p, title, startTime } : p)));
  }, []);

  const togglePlanOccurrence = useCallback(async (seriesId: number, date: string, completed: boolean): Promise<void> => {
    await api.setPlanOccurrenceCompleted(seriesId, date, completed);
    setPlans((prev) => prev.map((p) => (p.seriesId === seriesId && p.planDate === date ? { ...p, completedAt: completed ? new Date().toISOString() : null } : p)));
  }, []);

  const deletePlanSeries = useCallback(async (seriesId: number): Promise<void> => {
    await api.deleteWeeklyPlanSeries(seriesId);
    setPlans((prev) => prev.filter((p) => p.seriesId !== seriesId));
  }, []);

  const monthRange = getMonthRange(selectedDate);
  const weekRange = getWeekRange(selectedDate);
  const monthPlans = plans.filter(p => p.planDate >= monthRange.start && p.planDate <= monthRange.end);
  const weekPlans = plans.filter(p => p.planDate >= weekRange.start && p.planDate <= weekRange.end);
  const dayPlans = plans.filter(p => p.planDate === selectedDate);

  return (
    <AppShell>
      <div className="panel p-4 sm:p-6">
        <CalendarToolbar
          selectedDate={selectedDate}
          view={view}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
        />
        
        <ViewSwitcher view={view} onChange={setView} />

        <AnimatePresence initial={false}>
          {view === "month" && (
            <motion.div
              key="month"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <CalendarMonthView
                monthRange={monthRange}
                plans={monthPlans}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
                onPlanCreate={createPlan}
              />
            </motion.div>
          )}
          
          {view === "week" && (
            <motion.div
              key="week"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <WeeklyPlan
                plans={weekPlans}
                categories={categories}
                onDelete={deletePlan}
                onCreate={createPlan}
                onUpdate={updatePlan}
                onToggleCompleted={togglePlanCompleted}
                onCreateSeries={createPlanSeries}
                onUpdateOccurrenceOverride={updatePlanOccurrence}
                onToggleOccurrence={togglePlanOccurrence}
                onDeleteSeries={deletePlanSeries}
              />
            </motion.div>
          )}
          
          {view === "day" && (
            <motion.div
              key="day"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{new Date(selectedDate).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</h2>
              </div>
              {dayPlans.length === 0 ? (
                <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30">
                  <p className="text-[var(--text-faint)]">Nenhum plano para este dia</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {dayPlans.map((plan) => (
                    <div key={plan.id} className="rounded-lg border p-3" style={{ borderLeftColor: plan.color || plan.category.color }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{plan.title}</p>
                          {plan.startTime && <p className="text-[13px] text-[var(--text-faint)]">{plan.startTime}</p>}
                        </div>
                        <button
                          onClick={() => { /* toggle complete */ }}
                          className="flex h-8 w-8 items-center justify-center rounded-full border text-[var(--accent)]"
                          aria-label={plan.completedAt ? "Desmarcar" : "Concluir"}
                        >
                          ✓
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => {/* open create modal */}}
                className="w-full rounded-lg border border-dashed border-[var(--accent)] p-3 text-center text-[var(--accent)] font-medium"
              >
                + Adicionar plano
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
