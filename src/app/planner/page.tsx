"use client";

import { useCallback, useEffect, useState } from "react";
import type { WeeklyPlanItem, Category, WeeklyPlan } from "@/types";
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
import { TaskCard } from "@/components/planning/TaskCard";
import { WeekView } from "@/components/planning/WeekView";
import { DayView } from "@/components/planning/DayView";
import { AddTaskDialog } from "@/components/planning/AddTaskDialog";
import { Button } from "@/components/ui";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";

type View = "month" | "week" | "day";

// Primeira vez que a vista do mês é montada: entrada com stagger.
// Variável de módulo (não um ref) para não ler refs durante o render.
let monthFirstRender = true;

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = () => setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

function MobileDayAgenda({
  date,
  plans,
  onToggleCompleted,
  onDelete,
  onPlanCreate,
}: {
  date: string;
  plans: WeeklyPlanItem[];
  onToggleCompleted: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
  onPlanCreate: (date: string) => void;
}) {
  const today = todayIso();
  const isToday = date === today;
  const weekday = formatLocalDate(date, { weekday: "long" });
  const dateLabel = formatLocalDate(date, { day: "numeric", month: "long" });
  const sorted = [...plans].sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  const isEmpty = sorted.length === 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className={`text-sm font-medium ${isToday ? "text-[var(--accent)]" : ""}`}>
          {weekday}, {dateLabel}{isToday ? " · hoje" : ""}
        </h3>
        <Button size="sm" onClick={() => onPlanCreate(date)}>
          + Adicionar plano
        </Button>
      </div>
      {isEmpty ? (
        <button
          type="button"
          onClick={() => onPlanCreate(date)}
          className="day-empty-state-mobile group relative flex flex-col items-center justify-center py-8 text-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30 hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2 transition-all duration-200"
          aria-label={`Adicionar plano para ${weekday}, ${dateLabel.toLowerCase()}`}
        >
          <span className="absolute top-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[var(--accent-bg)] flex items-center justify-center">
            <Plus size={16} className="text-[var(--accent)]" aria-hidden="true" />
          </span>
          <p className="text-[var(--text)] font-semibold mb-1 relative z-10">Nenhum plano para este dia</p>
          <p className="text-[var(--text-secondary)] text-xs mb-3 relative z-10">Clique para criar seu primeiro plano</p>
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-bold text-[var(--bg-primary)] shadow-[0_0_8px_var(--accent-glow)] relative z-10">
            Adicionar plano
          </span>
        </button>
      ) : (
        <div className="flex flex-col gap-1">
          {sorted.map((plan) => (
            <div key={plan.id} className="group relative">
              <TaskCard
                plan={plan}
                onToggle={(completed) => onToggleCompleted(plan.id, completed)}
                onDelete={() => onDelete(plan.id)}
                alwaysVisible
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlanningPage() {
  const { user } = useAuthRedirect({ ifGuest: "/" });
  const [view, setView] = useState<View>("week");
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [tasks, setTasks] = useState<WeeklyPlanItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState<string | null>(null);
  const [navDirection, setNavDirection] = useState<"next" | "prev" | "zoom" | null>(null);
  const reduced = useReducedMotion();

  const isMobile = useMediaQuery("(max-width: 639px)");

  // Load all plans once (no weekStart filter → latest 50) and filter per view
  // client-side, so month/week/day always agree on the same source of truth.
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

  // Marca que o mês já foi montado uma vez (apenas leitura de variável de módulo durante o render).
  useEffect(() => {
    if (view === "month") monthFirstRender = false;
  }, [view]);

  // Keyboard shortcut: "N" opens add dialog in day view (ignore when in inputs/textareas/dialog)
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
  }, [view, selectedDate]);

  const week = weekRange(selectedDate);
  const month = monthRange(selectedDate);
  const inRange = (start: string, end: string) => (p: WeeklyPlanItem) =>
    p.planDate >= start && p.planDate <= end;
  const weekTasks = tasks.filter(inRange(week.start, week.end));
  const monthTasks = tasks.filter(inRange(month.start, month.end));
  const dayTasks = tasks.filter((p) => p.planDate === selectedDate);

  const handlePrev = () => {
    setNavDirection("prev");
    if (view === "month") setSelectedDate(addMonths(selectedDate, -1));
    else if (view === "week") setSelectedDate(addDays(selectedDate, -7));
    else setSelectedDate(addDays(selectedDate, -1));
  };
  const handleNext = () => {
    setNavDirection("next");
    if (view === "month") setSelectedDate(addMonths(selectedDate, 1));
    else if (view === "week") setSelectedDate(addDays(selectedDate, 7));
    else setSelectedDate(addDays(selectedDate, 1));
  };
  const handleToday = () => {
    setNavDirection("zoom");
    setSelectedDate(todayIso());
  };

  /** Cria um plano e o insere imediatamente na lista local (sem refresh). */
  const createTask = useCallback(
    async (planDate: string, title: string, categoryId: number | undefined): Promise<void> => {
      const res = await api.createWeeklyPlan({ planDate, title, categoryId });
      const cat = (categories.find((c) => c.id === res.plan.categoryId) || categories[0]) ?? null;
      setTasks((prev) => [...prev, toItem(res.plan, cat)]);
    },
    [categories],
  );

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

  const headerLabel = viewLabel(selectedDate, view);

  const monthViewTransitions = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 8 },
      };

  return (
    <AppShell>
      <div className="panel p-4 sm:p-6">
        <PlanningToolbar
          view={view}
          label={headerLabel}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
          onViewChange={setView}
        />

        <div className="flex flex-col gap-4">
          <AnimatePresence mode="popLayout">
            {view === "month" && (
              <motion.div
                key="month"
                {...monthViewTransitions}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <MonthView
                  monthRange={month}
                  plans={monthTasks}
                  selectedDate={selectedDate}
                  onDateSelect={(date) => {
                    setSelectedDate(date);
                    if (!isMobile) setView("day");
                  }}
                  onMonthNavigate={(date) => setSelectedDate(date)}
                  onPrevMonth={handlePrev}
                  onNextMonth={handleNext}
                  onPlanCreate={openAdd}
                  onToggleCompleted={togglePlan}
                  onDelete={deletePlan}
                  navDirection={navDirection}
                />
                {isMobile && (
                  <MobileDayAgenda
                    date={selectedDate}
                    plans={dayTasks}
                    onToggleCompleted={togglePlan}
                    onDelete={deletePlan}
                    onPlanCreate={openAdd}
                  />
                )}
              </motion.div>
            )}
            {view === "week" && (
              <motion.div
                key="week"
                {...monthViewTransitions}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
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
              </motion.div>
            )}
            {view === "day" && (
              <motion.div
                key="day"
                {...{
                  initial: reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92 },
                  animate: reduced ? { opacity: 1 } : { opacity: 1, scale: 1 },
                  exit: reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92 },
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
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
          onCreate={(planDate, title, categoryId) => createTask(planDate, title, categoryId)}
        />
      </div>
    </AppShell>
  );
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
