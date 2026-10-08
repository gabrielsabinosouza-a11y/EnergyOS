"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarCheck, Loader2, Plus } from "lucide-react";
import type { UserDailyTask } from "@/types";
import { api } from "@/lib/api-client";
import { toggleDailyTaskCompletion } from "@/lib/daily-task-actions";
import { todayIso } from "@/lib/db/dates";
import { HabitCard, type HabitTab } from "./habit-card";
import { HabitModal, type HabitPayload } from "./habit-modal";

const TABS: { id: HabitTab; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "geral", label: "Geral" },
  { id: "semanal", label: "Semanal" },
];

interface HabitTrackerState {
  tasks: UserDailyTask[];
  logsByTask: Record<number, Record<string, boolean>>;
  loading: boolean;
  error: string;
}

function indexTaskHistory(tasks: UserDailyTask[], entries: { taskId: number; date: string }[]) {
  const logsByTask: Record<number, Record<string, boolean>> = {};
  for (const task of tasks) {
    logsByTask[task.id] = task.isCompleted ? { [task.taskDate]: true } : {};
  }
  for (const entry of entries) {
    if (logsByTask[entry.taskId]) logsByTask[entry.taskId][entry.date] = true;
  }
  return logsByTask;
}

/** Tarefas diárias e seus check-ins reais; nenhuma meta é lida nesta seção. */
export function HabitTracker({ year }: { year: number }) {
  const today = useMemo(() => todayIso(), []);
  const [tab, setTab] = useState<HabitTab>("geral");
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);
  const [state, setState] = useState<HabitTrackerState>({
    tasks: [],
    logsByTask: {},
    loading: true,
    error: "",
  });
  const [showHabitModal, setShowHabitModal] = useState(false);
  const [modalHabit, setModalHabit] = useState<UserDailyTask | null>(null);
  const [saveNotice, setSaveNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const currentYear = Number(today.slice(0, 4));
      const from = `${Math.min(year, currentYear)}-01-01`;
      const to = year < currentYear ? today : `${year}-12-31`;
      const [taskResult, historyResult] = await Promise.all([
        api.getDailyTasks(true),
        api.getDailyTaskHistory(from, to),
      ]);
      setState({
        tasks: taskResult.tasks,
        logsByTask: indexTaskHistory(taskResult.tasks, historyResult.logs),
        loading: false,
        error: "",
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Não foi possível carregar as tarefas diárias.",
      }));
    }
  }, [today, year]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveHabit(payload: HabitPayload) {
    try {
      const result = modalHabit
        ? await api.updateDailyTask(modalHabit.id, payload)
        : await api.createDailyTask(payload);
      const savedTask = result.task;
      setState((prev) => ({
        ...prev,
        tasks: modalHabit
          ? prev.tasks.map((task) => task.id === savedTask.id ? savedTask : task)
          : [...prev.tasks, savedTask],
        logsByTask: modalHabit ? prev.logsByTask : { ...prev.logsByTask, [savedTask.id]: {} },
        error: "",
      }));
      setSaveNotice(modalHabit ? "Alterações salvas." : "Hábito criado.");
      setShowHabitModal(false);
      setModalHabit(null);
    } catch (error) {
      throw error instanceof Error ? error : new Error("Não foi possível salvar o hábito.");
    }
  }

  const toggle = useCallback(async (task: UserDailyTask, completed: boolean) => {
    if (busyTaskId !== null) return;
    setBusyTaskId(task.id);
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((item) => item.id === task.id ? { ...item, isCompleted: completed } : item),
      logsByTask: {
        ...prev.logsByTask,
        [task.id]: { ...(prev.logsByTask[task.id] ?? {}), [today]: completed },
      },
      error: "",
    }));
    try {
      const result = await toggleDailyTaskCompletion(task.id, completed);
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((item) => item.id === task.id ? result.task : item),
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((item) => item.id === task.id ? task : item),
        logsByTask: {
          ...prev.logsByTask,
          [task.id]: { ...(prev.logsByTask[task.id] ?? {}), [today]: task.isCompleted },
        },
        error: err instanceof Error ? err.message : "Não foi possível registrar o check-in.",
      }));
    } finally {
      setBusyTaskId(null);
    }
  }, [busyTaskId, today]);

  return (
    <section className="panel p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#ffb86b]/20 p-2 text-[#ffb86b]">
            <CalendarCheck size={18} />
          </div>
          <div>
            <h2 className="font-display text-xl">{HABIT_SECTION_TITLE}</h2>
            <p className="text-xs text-[var(--text-muted)]">Seus hábitos: sequência e check-in de cada um</p>
          </div>
        </div>
        <div className="flex overflow-hidden rounded-xl border border-[var(--border-subtle)]">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-pressed={tab === item.id}
              className={`cursor-pointer px-3.5 py-1.5 text-xs font-medium transition ${tab === item.id ? "bg-[var(--accent-bg)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {state.error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">
          <AlertCircle size={15} /> {state.error}
        </div>
      )}

      {state.loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={22} className="animate-spin text-[#71d4ff]" />
        </div>
      ) : state.tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">Crie seu primeiro hábito</p>
          <button
            type="button"
            onClick={() => { setModalHabit(null); setShowHabitModal(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#07111f] transition hover:opacity-90"
          >
            <Plus size={15} /> Criar primeiro hábito
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {state.tasks.map((task) => (
            <HabitCard
              key={task.id}
              task={task}
              logs={state.logsByTask[task.id] ?? {}}
              today={today}
              year={year}
              tab={tab}
              busyTaskId={busyTaskId}
              onToggle={(selected, completed) => void toggle(selected, completed)}
              onEdit={(selected) => { setModalHabit(selected); setShowHabitModal(true); }}
            />
          ))}
        </div>
      )}

      {saveNotice && <p role="status" className="mt-3 text-xs text-[var(--green)]">{saveNotice}</p>}
      {showHabitModal && (
        <HabitModal
          key={modalHabit?.id ?? "new"}
          habit={modalHabit}
          habitCount={state.tasks.length}
          onClose={() => { setShowHabitModal(false); setModalHabit(null); }}
          onSave={saveHabit}
        />
      )}
    </section>
  );
}

const HABIT_SECTION_TITLE = "Meus hábitos";
