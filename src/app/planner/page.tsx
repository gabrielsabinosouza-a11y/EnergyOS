"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WeeklyPlan, WeeklyPlanItem, Category } from "@/types";
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
import { PlanDialog } from "@/components/planning/PlanDialog";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type View = "month" | "week" | "day";
type PlanFormValues = {
  planDate: string;
  title: string;
  categoryId?: number;
  startTime: string | null;
  endTime: string | null;
};

function planKey(plan: WeeklyPlanItem): string {
  return plan.seriesId !== null
    ? `series:${plan.seriesId}:${plan.planDate}`
    : `plan:${plan.id}`;
}

function mergePlans(existing: WeeklyPlanItem[], incoming: WeeklyPlanItem[]): WeeklyPlanItem[] {
  const plans = new Map<string, WeeklyPlanItem>();
  for (const plan of incoming) plans.set(planKey(plan), plan);
  for (const plan of existing) {
    const key = planKey(plan);
    if (!plans.has(key)) plans.set(key, plan);
  }
  return [...plans.values()];
}

function fromWeeklyPlan(plan: WeeklyPlan): WeeklyPlanItem {
  return {
    id: plan.id,
    seriesId: null,
    planDate: plan.planDate,
    title: plan.title,
    categoryId: plan.categoryId,
    category: plan.category,
    iconType: null,
    iconValue: null,
    color: plan.category.color,
    note: null,
    completedAt: plan.completedAt ?? null,
    skipped: false,
    startTime: plan.startTime ?? null,
    endTime: plan.endTime ?? null,
    durationMinutes: null,
    repeatType: null,
    repeatDays: null,
    isRecurring: false,
  };
}

function monthGridRange(month: { start: string; end: string }) {
  return { start: weekRange(month.start).start, end: weekRange(month.end).end };
}

export default function PlanningPage() {
  const { user } = useAuthRedirect({ ifGuest: "/" });
  const [view, setView] = useState<View>("week");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [tasks, setTasks] = useState<WeeklyPlanItem[]>([]);
  const tasksRef = useRef(tasks);
  const mutationVersion = useRef(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goalDeadlines, setGoalDeadlines] = useState<Array<{ date: string; title: string }>>([]);
  const [goalDeadlinesError, setGoalDeadlinesError] = useState<string | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSession, setEditorSession] = useState(0);
  const [editingPlan, setEditingPlan] = useState<WeeklyPlanItem | null>(null);
  const [editorDate, setEditorDate] = useState<string | undefined>();
  const [editorStartTime, setEditorStartTime] = useState<string | undefined>();
  const [editorEndTime, setEditorEndTime] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<WeeklyPlanItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const deleteLoadingRef = useRef(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [navDirection, setNavDirection] = useState<"next" | "prev" | "zoom" | null>(null);
  const reduced = useReducedMotion();

  const updateTasks = useCallback((updater: (current: WeeklyPlanItem[]) => WeeklyPlanItem[]) => {
    const next = updater(tasksRef.current);
    tasksRef.current = next;
    setTasks(next);
  }, []);
  const announce = useCallback((message: string, error = false) => setFeedback({ message, error }), []);
  const month = useMemo(() => monthRange(selectedDate), [selectedDate]);
  const week = useMemo(() => weekRange(selectedDate), [selectedDate]);
  const monthRangeVisible = useMemo(() => monthGridRange(month), [month]);
  const dataRange = view === "month" ? monthRangeVisible : week;
  const weekStarts = useMemo(() => {
    const starts: string[] = [];
    for (let date = dataRange.start; date <= dataRange.end; date = addDays(date, 7)) starts.push(date);
    return starts;
  }, [dataRange.end, dataRange.start]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!user) return;
    let current = true;
    const requestVersion = mutationVersion.current;
    Promise.all(weekStarts.map((weekStart) => api.getWeeklyPlans(weekStart)))
      .then((weeks) => {
        if (!current || requestVersion !== mutationVersion.current) return;
        setPlansError(null);
        const incoming = weeks.flat().filter((plan) => plan.planDate >= dataRange.start && plan.planDate <= dataRange.end);
        updateTasks((existing) => mergePlans(
          existing.filter((plan) => plan.planDate < dataRange.start || plan.planDate > dataRange.end),
          incoming,
        ));
      })
      .catch(() => {
        if (current) setPlansError("Não foi possível carregar os planos deste período.");
      });
    return () => { current = false; };
  }, [dataRange.end, dataRange.start, updateTasks, user, weekStarts]);

  useEffect(() => {
    if (!user) return;
    let current = true;
    api.getCategories()
      .then((res) => {
        if (current) setCategories(res.categories || []);
      })
      .catch(() => {
        if (current) announce("Não foi possível carregar as categorias dos planos.", true);
      });
    return () => { current = false; };
  }, [announce, user]);

  useEffect(() => {
    if (!user || view !== "month") return;
    let current = true;
    api.getGoals()
      .then((goals) => {
        if (!current) return;
        setGoalDeadlines(
          goals.flatMap(({ goal }) => goal.deadline && !goal.completedAt
            ? [{ date: goal.deadline, title: goal.title }]
            : []),
        );
        setGoalDeadlinesError(null);
      })
      .catch(() => {
        if (current) setGoalDeadlinesError("Não foi possível carregar os prazos das metas.");
      });
    return () => { current = false; };
  }, [user, view]);

  const openCreate = useCallback((date: string, minutes?: number) => {
    setEditorSession((session) => session + 1);
    setEditingPlan(null);
    setEditorDate(date);
    if (minutes !== undefined) {
      setEditorStartTime(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
      const end = Math.min(minutes + 60, 23 * 60 + 59);
      setEditorEndTime(`${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`);
    } else {
      setEditorStartTime(undefined);
      setEditorEndTime(undefined);
    }
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((plan: WeeklyPlanItem) => {
    setEditorSession((session) => session + 1);
    setEditingPlan(plan);
    setSelectedDate(plan.planDate);
    setEditorDate(undefined);
    setEditorStartTime(undefined);
    setEditorEndTime(undefined);
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditingPlan(null);
  }, []);

  useEffect(() => {
    if (view !== "day") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement;
      if (!active) return;
      const tagName = active.tagName.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || active.getAttribute("role") === "dialog") return;
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        openCreate(selectedDate);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openCreate, selectedDate, view]);

  const inRange = (start: string, end: string) => (plan: WeeklyPlanItem) =>
    plan.planDate >= start && plan.planDate <= end;
  const weekTasks = useMemo(() => tasks.filter(inRange(week.start, week.end)), [tasks, week.end, week.start]);
  const monthGridTasks = useMemo(
    () => tasks.filter(inRange(monthRangeVisible.start, monthRangeVisible.end)),
    [monthRangeVisible.end, monthRangeVisible.start, tasks],
  );
  const dayTasks = useMemo(() => tasks.filter((plan) => plan.planDate === selectedDate), [selectedDate, tasks]);
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
    if (view === "month") setSelectedDate(addMonths(month.start, -1));
    else if (view === "week") setSelectedDate(addDays(selectedDate, -7));
    else setSelectedDate(addDays(selectedDate, -1));
  }, [month.start, selectedDate, view]);
  const handleNext = useCallback(() => {
    setNavDirection("next");
    if (view === "month") setSelectedDate(addMonths(month.start, 1));
    else if (view === "week") setSelectedDate(addDays(selectedDate, 7));
    else setSelectedDate(addDays(selectedDate, 1));
  }, [month.start, selectedDate, view]);
  const handleToday = useCallback(() => {
    setNavDirection("zoom");
    setSelectedDate(todayIso());
  }, []);

  const savePlan = useCallback(async (plan: WeeklyPlanItem | null, values: PlanFormValues) => {
    if (plan?.seriesId !== null && plan?.seriesId !== undefined) {
      await api.updatePlanOccurrenceOverride(plan.seriesId, plan.planDate, {
        title: values.title,
        startTime: values.startTime,
      });
      mutationVersion.current += 1;
      updateTasks((current) => current.map((item) => planKey(item) === planKey(plan)
        ? { ...item, title: values.title, startTime: values.startTime }
        : item));
      announce("Ocorrência atualizada.");
      return;
    }

    if (plan) {
      const { plan: updated } = await api.updateWeeklyPlan(plan.id, {
        title: values.title,
        categoryId: values.categoryId ?? plan.categoryId,
        planDate: values.planDate,
        startTime: values.startTime,
        endTime: values.endTime,
      });
      mutationVersion.current += 1;
      updateTasks((current) => current.map((item) => item.seriesId === null && item.id === plan.id
        ? fromWeeklyPlan(updated)
        : item));
      announce("Plano atualizado.");
      return;
    }

    const { plan: created } = await api.createWeeklyPlan({
      planDate: values.planDate,
      title: values.title,
      categoryId: values.categoryId,
      startTime: values.startTime,
      endTime: values.endTime,
    });
    mutationVersion.current += 1;
    updateTasks((current) => mergePlans(current, [fromWeeklyPlan(created)]));
    announce("Plano criado.");
  }, [announce, updateTasks]);

  const completionRequests = useRef(new Map<string, Promise<void>>());
  const completionSequence = useRef(new Map<string, number>());
  const confirmedCompletion = useRef(new Map<string, string | null>());

  const togglePlan = useCallback((plan: WeeklyPlanItem, completed: boolean): Promise<void> => {
    const key = planKey(plan);
    const matches = (item: WeeklyPlanItem) => planKey(item) === key;
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
        mutationVersion.current += 1;
        confirmedCompletion.current.set(key, completed ? new Date().toISOString() : null);
      } catch (error) {
        if (completionSequence.current.get(key) === sequence) {
          const confirmed = confirmedCompletion.current.get(key) ?? null;
          updateTasks((current) => current.map((item) => matches(item)
            ? { ...item, completedAt: confirmed, skipped: false }
            : item));
        }
        throw error;
      }
    });
    completionRequests.current.set(key, request);
    const cleanup = () => {
      if (completionRequests.current.get(key) === request) completionRequests.current.delete(key);
    };
    void request.then(cleanup, cleanup);
    return request;
  }, [updateTasks]);

  const handleToggleCompleted = useCallback(async (plan: WeeklyPlanItem, completed: boolean) => {
    try {
      await togglePlan(plan, completed);
      announce(completed ? "Plano concluído." : "Plano reaberto.");
    } catch {
      announce("Não foi possível atualizar o plano. Tente novamente.", true);
    }
  }, [announce, togglePlan]);

  const requestDelete = useCallback((plan: WeeklyPlanItem) => {
    setDeleteTarget(plan);
    setDeleteError(null);
  }, []);

  const closeDelete = useCallback(() => {
    if (deleteLoadingRef.current) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || deleteLoading) return;
    deleteLoadingRef.current = true;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      if (deleteTarget.seriesId !== null) {
        await api.skipPlanOccurrence(deleteTarget.seriesId, deleteTarget.planDate);
      } else {
        await api.deleteWeeklyPlan(deleteTarget.id);
      }
      mutationVersion.current += 1;
      updateTasks((current) => current.filter((plan) => planKey(plan) !== planKey(deleteTarget)));
      setDeleteTarget(null);
      announce("Plano excluído.");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Não foi possível excluir o plano.");
    } finally {
      deleteLoadingRef.current = false;
      setDeleteLoading(false);
    }
  }, [announce, deleteLoading, deleteTarget, updateTasks]);

  const headerLabel = viewLabel(selectedDate, view);
  const monthTitle = formatLocalDate(month.start, { month: "long", year: "numeric" });
  const selectMonthDate = useCallback((date: string) => setSelectedDate(date), []);
  const navigateMonthDate = useCallback((date: string, direction: "prev" | "next") => {
    setNavDirection(direction);
    setSelectedDate(date);
  }, []);

  return (
    <AppShell>
      <div className="planner-root flex h-full min-h-0 flex-col">
        <div className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6">
          <PlanningToolbar
            view={view}
            label={headerLabel}
            title={view === "month" ? monthTitle : undefined}
            onPrev={handlePrev}
            onNext={handleNext}
            onToday={handleToday}
            onViewChange={setView}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 sm:px-6">
          {plansError ? (
            <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-400" role="alert">
              {plansError}
            </p>
          ) : null}
          <AnimatePresence mode="wait">
            {view === "month" && (
              <motion.div
                key="month"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                transition={{ duration: reduced ? 0 : 0.18, ease: "easeOut" }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <MonthView
                  monthRange={month}
                  plans={monthGridTasks}
                  selectedDate={selectedDate}
                  navigationDirection={navDirection}
                  importantDays={importantDays}
                  importantDaysError={goalDeadlinesError}
                  plansError={plansError}
                  onDateSelect={selectMonthDate}
                  onMonthNavigate={navigateMonthDate}
                  onPrevMonth={handlePrev}
                  onNextMonth={handleNext}
                  onPlanCreate={openCreate}
                  onToggleCompleted={handleToggleCompleted}
                  onEditPlan={openEdit}
                  onDeletePlan={requestDelete}
                />
              </motion.div>
            )}
            {view === "week" && (
              <motion.div
                key="week"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                transition={{ duration: reduced ? 0 : 0.18, ease: "easeOut" }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <WeekView
                  weekRange={week}
                  plans={weekTasks}
                  selectedDate={selectedDate}
                  onDateSelect={(date) => {
                    setSelectedDate(date);
                    setView("day");
                  }}
                  onPlanCreate={openCreate}
                  onToggleCompleted={handleToggleCompleted}
                  onEditPlan={openEdit}
                  onDeletePlan={requestDelete}
                />
              </motion.div>
            )}
            {view === "day" && (
              <motion.div
                key="day"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={{ duration: reduced ? 0 : 0.18, ease: "easeOut" }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <DayView
                  date={selectedDate}
                  plans={dayTasks}
                  onToggleCompleted={handleToggleCompleted}
                  onEditPlan={openEdit}
                  onDeletePlan={requestDelete}
                  onPlanCreate={openCreate}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {feedback ? (
            <motion.p
              key={feedback.message}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.16 }}
              className={`fixed bottom-5 right-5 z-[80] max-w-[calc(100vw-2.5rem)] rounded-xl border px-4 py-3 text-sm shadow-xl ${
                feedback.error
                  ? "border-red-500/30 bg-[var(--bg-primary)] text-red-400"
                  : "border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text)]"
              }`}
              role={feedback.error ? "alert" : "status"}
            >
              {feedback.message}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <PlanDialog
          key={editorSession}
          open={editorOpen}
          plan={editingPlan}
          initialDate={editorDate}
          initialStartTime={editorStartTime}
          initialEndTime={editorEndTime}
          categories={categories}
          onClose={closeEditor}
          onSave={savePlan}
        />

        <Modal
          open={Boolean(deleteTarget)}
          onClose={closeDelete}
          title="Excluir plano?"
          description="Esta ação remove o plano do calendário."
          panelClassName="max-w-[420px]"
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={deleteLoading}
                onClick={() => setDeleteTarget(null)}
                className="ml-auto"
              >
                Cancelar
              </Button>
              <Button type="button" variant="danger" loading={deleteLoading} disabled={deleteLoading} onClick={() => void confirmDelete()}>
                Excluir plano
              </Button>
            </>
          }
        >
          <p className="text-sm text-[var(--text-secondary)]">
            {deleteTarget?.seriesId !== null && deleteTarget?.seriesId !== undefined
              ? "Somente esta ocorrência será removida; os demais dias da série permanecem."
              : <>Tem certeza de que deseja excluir <strong className="text-[var(--text)]">{deleteTarget?.title || "este plano"}</strong>?</>}
          </p>
          {deleteError ? <p className="mt-3 text-sm text-red-400" role="alert">{deleteError}</p> : null}
        </Modal>
      </div>
    </AppShell>
  );
}
