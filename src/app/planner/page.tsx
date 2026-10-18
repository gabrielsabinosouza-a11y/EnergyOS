"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WeeklyPlanItem, Category } from "@/types";
import { api } from "@/lib/api-client";
import {
  addDays,
  addMonths,
  formatLocalDate,
  monthRange,
  todayIso,
  viewLabel,
  weekRange,
} from "@/lib/planning/dates";
import { AppShell } from "@/components/app-shell";
import { useAuthRedirect } from "@/lib/auth-context";
import { PlanningToolbar } from "@/components/planning/PlanningToolbar";
import { MonthView } from "@/components/planning/MonthView";
import { WeekView } from "@/components/planning/WeekView";
import { DayView } from "@/components/planning/DayView";
import { AddTaskDialog } from "@/components/planning/AddTaskDialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type View = "month" | "week" | "day";

function mergeNewPlans(existing: WeeklyPlanItem[], incoming: WeeklyPlanItem[]): WeeklyPlanItem[] {
  const merged = new Map<string, WeeklyPlanItem>();
  for (const plan of existing) {
    const key = plan.seriesId !== null
      ? `series:${plan.seriesId}:${plan.planDate}`
      : `plan:${plan.id}`;
    merged.set(key, plan);
  }
  for (const plan of incoming) {
    const key = plan.seriesId !== null
      ? `series:${plan.seriesId}:${plan.planDate}`
      : `plan:${plan.id}`;
    if (!merged.has(key)) merged.set(key, plan);
  }
  return [...merged.values()];
}

export default function PlanningPage() {
  const { user } = useAuthRedirect({ ifGuest: "/" });
  const [view, setView] = useState<View>("week");
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [tasks, setTasks] = useState<WeeklyPlanItem[]>([]);
  const tasksRef = useRef<WeeklyPlanItem[]>(tasks);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goalDeadlines, setGoalDeadlines] = useState<Array<{ date: string; title: string }>>([]);
  const [goalDeadlinesError, setGoalDeadlinesError] = useState<string | null>(null);
  const [monthPlansError, setMonthPlansError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState<string | null>(null);
  const [addStartTime, setAddStartTime] = useState<string | undefined>(undefined);
  const [addEndTime, setAddEndTime] = useState<string | undefined>(undefined);
  const [navDirection, setNavDirection] = useState<"next" | "prev" | "zoom" | null>(null);
  const reduced = useReducedMotion();

  const updateTasks = useCallback((updater: (current: WeeklyPlanItem[]) => WeeklyPlanItem[]) => {
    const next = updater(tasksRef.current);
    tasksRef.current = next;
    setTasks(next);
  }, []);
  const month = useMemo(() => monthRange(selectedDate), [selectedDate]);

  // Load all plans once (no weekStart filter → latest 50) and filter per view
  // client-side, so month/week/day always agree on the same source of truth.
  useEffect(() => {
    if (!user) return;
    api.getWeeklyPlans()
      .then((items: WeeklyPlanItem[]) => updateTasks((existing) => mergeNewPlans(existing, items)))
      .catch(console.error);
  }, [user, updateTasks]);

  // Load categories once.
  useEffect(() => {
    if (!user) return;
    api.getCategories()
      .then((res) => setCategories(res.categories || []))
      .catch(console.error);
  }, [user]);

  // Goal deadlines are the existing source for important calendar days.
  useEffect(() => {
    if (!user || view !== "month") return;
    api.getGoals()
      .then((goals) => {
        setGoalDeadlines(
          goals.flatMap(({ goal }) => goal.deadline && !goal.completedAt
            ? [{ date: goal.deadline, title: goal.title }]
            : []),
        );
        setGoalDeadlinesError(null);
      })
      .catch(() => setGoalDeadlinesError("Não foi possível carregar os prazos das metas."));
  }, [user, view]);

  useEffect(() => {
    if (!user || view !== "month") return;
    let current = true;
    const firstWeek = weekRange(month.start).start;
    const lastWeek = weekRange(month.end).start;
    const weekStarts: string[] = [];
    for (let date = firstWeek; date <= lastWeek; date = addDays(date, 7)) weekStarts.push(date);

    Promise.all(weekStarts.map((weekStart) => api.getWeeklyPlans(weekStart)))
      .then((weeks) => {
        if (!current) return;
        setMonthPlansError(null);
        const rangePlans = weeks.flat();
        updateTasks((existing) => mergeNewPlans(existing, rangePlans));
      })
      .catch(() => {
        if (current) setMonthPlansError("Não foi possível carregar os planos deste mês.");
      });

    return () => { current = false; };
  }, [month.end, month.start, updateTasks, user, view]);

  // Keyboard shortcut: "N" opens add dialog in day view (ignore when in inputs/textareas/dialog)
  const openAdd = useCallback(
    (date: string, minutes?: number) => {
      setAddDate(date);
      if (minutes != null) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        setAddStartTime(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        setAddEndTime(`${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      } else {
        setAddStartTime(undefined);
        setAddEndTime(undefined);
      }
      setAddOpen(true);
    },
    [],
  );

  useEffect(() => {
    if (view !== "day") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in an input, textarea, or dialog
      const active = document.activeElement;
      if (!active) return;
      const tagName = active.tagName.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || active.getAttribute("role") === "dialog") return;

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        openAdd(selectedDate);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, selectedDate, openAdd]);

  const week = useMemo(() => weekRange(selectedDate), [selectedDate]);
  const inRange = (start: string, end: string) => (p: WeeklyPlanItem) => p.planDate >= start && p.planDate <= end;
  const weekTasks = useMemo(() => tasks.filter(inRange(week.start, week.end)), [tasks, week.start, week.end]);
  const monthGridStart = useMemo(() => weekRange(month.start).start, [month.start]);
  const monthGridEnd = useMemo(() => weekRange(month.end).end, [month.end]);
  const monthGridTasks = useMemo(
    () => tasks.filter(inRange(monthGridStart, monthGridEnd)),
    [tasks, monthGridEnd, monthGridStart],
  );
  const dayTasks = useMemo(() => tasks.filter((p) => p.planDate === selectedDate), [tasks, selectedDate]);
  const importantDays = useMemo(() => {
    const result = new Map<string, string[]>();
    for (const goal of goalDeadlines) {
      const reasons = result.get(goal.date) ?? [];
      reasons.push(`Prazo da meta: ${goal.title}`);
      result.set(goal.date, reasons);
    }
    return result;
  }, [goalDeadlines]);

  const handlePrev = useCallback(() => {
    setNavDirection("prev");
    if (view === "month") setMonthPlansError(null);
    if (view === "month") setSelectedDate(addMonths(month.start, -1));
    else if (view === "week") setSelectedDate(addDays(selectedDate, -7));
    else setSelectedDate(addDays(selectedDate, -1));
  }, [month.start, selectedDate, view]);
  const handleNext = useCallback(() => {
    setNavDirection("next");
    if (view === "month") setMonthPlansError(null);
    if (view === "month") setSelectedDate(addMonths(month.start, 1));
    else if (view === "week") setSelectedDate(addDays(selectedDate, 7));
    else setSelectedDate(addDays(selectedDate, 1));
  }, [month.start, selectedDate, view]);
  const handleToday = useCallback(() => {
    setNavDirection("zoom");
    setMonthPlansError(null);
    setSelectedDate(todayIso());
  }, []);

  /** Cria um plano e o insere imediatamente na lista local (sem refresh). */
  const createTask = useCallback(
    async (planDate: string, title: string, categoryId: number | undefined, startTime?: string, endTime?: string): Promise<void> => {
      const res = await api.createWeeklyPlan({ planDate, title, categoryId, startTime: startTime ?? null, endTime: endTime ?? null });
      const cat = (categories.find((c) => c.id === res.plan.categoryId) || categories[0]) ?? null;
      updateTasks((prev) => [
        ...prev,
        {
          id: res.plan.id,
          seriesId: null,
          planDate: res.plan.planDate,
          title: res.plan.title,
          categoryId: res.plan.categoryId,
          category: cat ?? ({ id: 0, userId: null, name: "", color: "#94a3b8", icon: null, isCustom: false, createdAt: "" } as Category),
          iconType: null,
          iconValue: null,
          color: cat?.color ?? null,
          note: null,
          completedAt: res.plan.completedAt ?? null,
          skipped: false,
          startTime: res.plan.startTime ?? null,
          durationMinutes: null,
          repeatType: null,
          repeatDays: null,
          isRecurring: false,
        },
      ]);
    },
    [categories, updateTasks],
  );

  const togglePlan = useCallback(
    async (id: number, completed: boolean) => {
      const plan = tasksRef.current.find((p) => p.id === id);
      if (plan && plan.seriesId !== null) {
        await api.setPlanOccurrenceCompleted(plan.seriesId, plan.planDate, completed);
        updateTasks((prev) =>
          prev.map((p) =>
            p.seriesId === plan.seriesId && p.planDate === plan.planDate ? { ...p, completedAt: completed ? new Date().toISOString() : null, skipped: false } : p,
          ),
        );
        return;
      }
      await api.setWeeklyPlanCompleted(id, completed);
      updateTasks((prev) => prev.map((p) => (p.id === id ? { ...p, completedAt: completed ? new Date().toISOString() : null } : p)));
    },
    [updateTasks],
  );

  const completionRequests = useRef(new Map<string, Promise<void>>());
  const completionSequence = useRef(new Map<string, number>());
  const confirmedCompletion = useRef(new Map<string, string | null>());

  const togglePlanOptimistically = useCallback((plan: WeeklyPlanItem, completed: boolean): Promise<void> => {
    const key = plan.seriesId !== null ? `series:${plan.seriesId}:${plan.planDate}` : `plan:${plan.id}`;
    const matches = (item: WeeklyPlanItem) => plan.seriesId !== null
      ? item.seriesId === plan.seriesId && item.planDate === plan.planDate
      : item.id === plan.id;
    if (!confirmedCompletion.current.has(key)) {
      confirmedCompletion.current.set(key, tasksRef.current.find(matches)?.completedAt ?? null);
    }
    const sequence = (completionSequence.current.get(key) ?? 0) + 1;
    completionSequence.current.set(key, sequence);
    updateTasks((current) => current.map((item) => matches(item)
      ? { ...item, completedAt: completed ? new Date().toISOString() : null, skipped: false }
      : item));

    const previous = completionRequests.current.get(key) ?? Promise.resolve();
    const request = previous.catch(() => undefined).then(async () => {
      try {
        if (plan.seriesId !== null) {
          await api.setPlanOccurrenceCompleted(plan.seriesId, plan.planDate, completed);
        } else {
          await api.setWeeklyPlanCompleted(plan.id, completed);
        }
        confirmedCompletion.current.set(key, completed ? new Date().toISOString() : null);
      } catch (error) {
        if (completionSequence.current.get(key) === sequence) {
          const confirmed = confirmedCompletion.current.get(key) ?? null;
          updateTasks((current) => current.map((item) => matches(item)
            ? { ...item, completedAt: confirmed, skipped: false }
            : item));
          throw error;
        }
      }
    });
    completionRequests.current.set(key, request);
    const cleanup = () => {
      if (completionRequests.current.get(key) === request) completionRequests.current.delete(key);
    };
    void request.then(cleanup, cleanup);
    return request;
  }, [updateTasks]);

  const deletePlan = useCallback(async (id: number) => {
    await api.deleteWeeklyPlan(id);
    updateTasks((prev) => prev.filter((p) => p.id !== id));
  }, [updateTasks]);

  const headerLabel = viewLabel(selectedDate, view);
  const monthTitle = formatLocalDate(month.start, { month: "long", year: "numeric" });
  const selectMonthDate = useCallback((date: string) => setSelectedDate(date), []);
  const navigateMonthDate = useCallback((date: string, direction: "prev" | "next") => {
    setNavDirection(direction);
    setMonthPlansError(null);
    setSelectedDate(date);
  }, []);

  const viewSwitchProps = {
    onPrev: handlePrev,
    onNext: handleNext,
    onToday: handleToday,
    onViewChange: setView,
  };

  return (
    <AppShell>
      <div className="planner-root flex h-full min-h-0 flex-col">
        <div className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6">
          <PlanningToolbar
            view={view}
            label={headerLabel}
            title={view === "month" ? monthTitle : undefined}
            {...viewSwitchProps}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 sm:px-6">
          <AnimatePresence mode="wait">
            {view === "month" && (
              <motion.div
                key="month"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <MonthView
                  monthRange={month}
                  plans={monthGridTasks}
                  selectedDate={selectedDate}
                  navigationDirection={navDirection}
                  importantDays={importantDays}
                  importantDaysError={goalDeadlinesError}
                  plansError={monthPlansError}
                  onDateSelect={selectMonthDate}
                  onMonthNavigate={navigateMonthDate}
                  onPrevMonth={handlePrev}
                  onNextMonth={handleNext}
                  onPlanCreate={openAdd}
                  onToggleCompleted={togglePlanOptimistically}
                />
              </motion.div>
            )}
            {view === "week" && (
              <motion.div
                key="week"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <WeekView
                  monthRange={week}
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
              </motion.div>
            )}
            {view === "day" && (
              <motion.div
                key="day"
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <DayView
                  date={selectedDate}
                  plans={dayTasks}
                  onToggleCompleted={togglePlan}
                  onDelete={deletePlan}
                  onPlanCreate={openAdd}
                  shortcutHint="N"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AddTaskDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          planDate={addDate ?? undefined}
          initialStartTime={addStartTime}
          initialEndTime={addEndTime}
          onCreate={createTask}
        />
      </div>
    </AppShell>
  );
}
