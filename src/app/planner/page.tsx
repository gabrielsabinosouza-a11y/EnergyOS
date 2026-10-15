"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { WeeklyPlanItem, Category, WeeklyPlan } from "@/types";
import { api } from "@/lib/api-client";
import { todayIso, weekStartIso, addDaysIso, getMonthRange, getWeekRange } from "@/lib/db/dates";
import { AppShell } from "@/components/app-shell";
import { useAuthRedirect } from "@/lib/auth-context";
import { CalendarToolbar } from "@/components/calendar/CalendarToolbar";
import { ViewSwitcher } from "@/components/calendar/ViewSwitcher";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { CalendarWeekView } from "@/components/calendar/CalendarWeekView";
import { Check, Plus, X, Pencil } from "lucide-react";

type CalendarView = "month" | "week" | "day";

// Convert WeeklyPlan (from API) to WeeklyPlanItem (UI format)
function toWeeklyPlanItem(plan: WeeklyPlan, category: Category): WeeklyPlanItem {
  return {
    id: plan.id,
    seriesId: null,
    planDate: plan.planDate,
    title: plan.title,
    categoryId: plan.categoryId,
    category,
    iconType: null,
    iconValue: null,
    color: category.color,
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

export default function CalendarPage() {
  const { user } = useAuthRedirect({ ifGuest: "/" });
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [view, setView] = useState<CalendarView>("week");
  const [plans, setPlans] = useState<WeeklyPlanItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Fetch weekly plans
  useEffect(() => {
    if (!user) return;
    api.getWeeklyPlans(weekStartIso(selectedDate))
      .then((items: WeeklyPlanItem[]) => setPlans(items))
      .catch(console.error);
  }, [selectedDate, user]);

  // Fetch categories
  useEffect(() => {
    if (!user) return;
    api.getCategories()
      .then((res) => {
        setCategories(res.categories);
      })
      .catch(console.error);
  }, [user]);

  const handlePrev = () => setSelectedDate(addDaysIso(selectedDate, view === "month" ? -30 : -7));
  const handleNext = () => setSelectedDate(addDaysIso(selectedDate, view === "month" ? 30 : 7));
  const handleToday = () => setSelectedDate(todayIso());

  // Plan handlers
  const createPlan = useCallback(async (planDate: string, title: string, categoryId: number): Promise<void> => {
    const res = await api.createWeeklyPlan({ planDate, title, categoryId });
    const cat = categories.find(c => c.id === categoryId) || categories[0];
    setPlans((prev) => [...prev, toWeeklyPlanItem(res.plan, cat)]);
  }, [categories]);

  const updatePlan = useCallback(async (id: number, title: string, categoryId: number, planDate: string): Promise<void> => {
    const res = await api.updateWeeklyPlan(id, { title, categoryId, planDate });
    const cat = categories.find(c => c.id === categoryId) || categories[0];
    setPlans((prev) => prev.map((p) => (p.id === id ? toWeeklyPlanItem(res.plan, cat) : p)));
  }, [categories]);

  const togglePlanCompleted = useCallback(async (id: number, completed: boolean): Promise<void> => {
    const res = await api.setWeeklyPlanCompleted(id, completed);
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, completedAt: res.plan.completedAt ?? null } : p)));
  }, []);


  const toggleOccurrenceCompleted = useCallback(
    async (seriesId: number, date: string, completed: boolean): Promise<void> => {
      await api.setPlanOccurrenceCompleted(seriesId, date, completed);

      setPlans((prev) =>
        prev.map((plan) =>
          plan.seriesId === seriesId && plan.planDate === date
            ? {
                ...plan,
                completedAt: completed ? new Date().toISOString() : null,
                skipped: false,
              }
            : plan,
        ),
      );
    },
    [],
  );

  const updateOccurrenceOverride = useCallback(
    async (
      seriesId: number,
      date: string,
      title: string,
      startTime: string | null,
    ): Promise<void> => {
      await api.updatePlanOccurrenceOverride(seriesId, date, {
        title: title.trim(),
        startTime,
      });

      setPlans((prev) =>
        prev.map((plan) =>
          plan.seriesId === seriesId && plan.planDate === date
            ? {
                ...plan,
                title: title.trim(),
                startTime,
              }
            : plan,
        ),
      );
    },
    [],
  );



  const deletePlan = useCallback(async (id: number): Promise<void> => {
    await api.deleteWeeklyPlan(id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const monthRange = getMonthRange(selectedDate);
  const weekRange = getWeekRange(selectedDate);
  const monthPlans = plans.filter(p => p.planDate >= monthRange.start && p.planDate <= monthRange.end);
  const weekPlans = plans.filter(p => p.planDate >= weekRange.start && p.planDate <= weekRange.end);
  const dayPlans = plans.filter(p => p.planDate === selectedDate);

  // Day view handlers
  const dayCreatePlan = useCallback((planDate: string, title: string, categoryId: number) => {
    if (title.trim()) {
      void createPlan(planDate, title, categoryId);
    }
  }, [createPlan]);

  const dayUpdatePlan = useCallback((id: number, title: string, categoryId: number, planDate: string) => {
    if (!title.trim()) {
      void deletePlan(id);
      return;
    }
    void updatePlan(id, title, categoryId, planDate);
  }, [updatePlan, deletePlan]);

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

        <AnimatePresence initial={false} mode="popLayout">
          {view === "month" && (
            <motion.div
              key="month"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <CalendarWeekView
                weekRange={weekRange}
                plans={weekPlans}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
                onPlanCreate={dayCreatePlan}
                onUpdate={dayUpdatePlan}
                onToggleCompleted={togglePlanCompleted}
                onDelete={deletePlan}
                onToggleOccurrence={toggleOccurrenceCompleted}
                onUpdateOccurrenceOverride={updateOccurrenceOverride}
                categories={categories}
              />
            </motion.div>
          )}

          {view === "day" && (
            <motion.div
              key="day"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    {new Date(selectedDate).toLocaleDateString("pt-BR", { weekday: "long" })}
                  </h2>
                  <p className="text-[var(--text-faint)] text-sm">
                    {new Date(selectedDate).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>

              {dayPlans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30">
                  <div className="w-12 h-12 mb-3 rounded-full bg-[var(--accent-bg)] flex items-center justify-center">
                    <Pencil size={20} className="text-[var(--accent)]" />
                  </div>
                  <p className="text-[var(--text-faint)] font-medium mb-2">Nenhum plano para este dia</p>
                  <p className="text-[var(--text-sm)]">Comece criando um novo plano</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {dayPlans.map((plan) => {
                    const isCompleted = Boolean(plan.completedAt);
                    const displayColor = plan.color || plan.category.color;

                    return (
                      <div
                        key={plan.id}
                        className="group flex items-center justify-between rounded-xl border p-3 transition-all"
                        style={{
                          backgroundColor: isCompleted ? "rgba(154, 255, 184, 0.08)" : "rgba(255, 255, 255, 0.05)",
                          borderLeftColor: displayColor,
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium ${isCompleted ? "line-through opacity-60" : ""}`}>
                            {plan.title}
                          </p>
                          {plan.startTime && (
                            <p className="text-[13px] text-[var(--text-faint)]">{plan.startTime}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => dayUpdatePlan(plan.id, plan.title, plan.categoryId, plan.planDate)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--bg-secondary)]"
                            aria-label="Editar plano"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePlan(plan.id);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-faint)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)]"
                            aria-label="Excluir plano"
                          >
                            <X size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => togglePlanCompleted(plan.id, !isCompleted)}
                            aria-label={isCompleted ? "Desmarcar plano" : "Concluir plano"}
                            className="flex h-8 w-8 items-center justify-center rounded-full transition-all"
                            style={{
                              backgroundColor: isCompleted ? displayColor : "rgba(255, 255, 255, 0.05)",
                              border: "2px solid",
                              borderColor: isCompleted ? displayColor : "var(--text-muted)",
                              color: isCompleted ? "white" : "var(--text-muted)",
                            }}
                          >
                            <Check size={16} strokeWidth={isCompleted ? 3 : 2} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => createPlan(selectedDate, "", 0)}
                className="w-full rounded-xl border border-dashed border-[var(--accent)] p-3 text-center text-[var(--accent)] font-medium hover:bg-[var(--accent-bg)] transition-colors"
              >
                <Plus size={20} className="inline mr-2" />
                Adicionar plano
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
