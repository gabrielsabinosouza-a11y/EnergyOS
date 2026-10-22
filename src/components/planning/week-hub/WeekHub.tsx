"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarPlus, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Flame, Focus, Lightbulb, ListChecks, Plus, RotateCw, Sparkles, Timer, X } from "lucide-react";
import type { Category, WeeklyPlanItem } from "@/types";
import { addDays, formatLocalDate, todayIso } from "@/lib/planning/dates";
import { eventColor } from "@/lib/planning/categories";
import { PlanRow } from "../PlanRow";
import { AnimatedNumber } from "@/components/ui";
import { buildWeekStats, countdownLabel, localPlanTimestamp, weekProgressCopy, type WeekStats } from "./stats";

interface WeekHubProps {
  weekStart: string;
  plans: WeeklyPlanItem[];
  selectedDate: string;
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectDay: (date: string) => void;
  onCreatePlan: (date: string) => void;
  onQuickAdd: (date: string, title: string, startTime: string | null, categoryId?: number) => Promise<WeeklyPlanItem>;
  onUndoQuickAdd: (plan: WeeklyPlanItem) => Promise<void>;
  onToggleCompleted: (plan: WeeklyPlanItem, completed: boolean) => void;
  onEditPlan: (plan: WeeklyPlanItem) => void;
  onDeletePlan: (plan: WeeklyPlanItem) => void;
}

const enter = { hidden: { opacity: 0, y: 12, filter: "blur(8px)" }, visible: { opacity: 1, y: 0, filter: "blur(0px)" } };

function GlassCard({ children, className = "", label }: { children: React.ReactNode; className?: string; label?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      aria-label={label}
      variants={enter}
      initial={reduced ? false : "hidden"}
      animate="visible"
      transition={{ duration: reduced ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduced ? undefined : { y: -2 }}
      className={`relative min-w-0 overflow-hidden rounded-2xl border border-white/[.08] bg-[color-mix(in_srgb,var(--bg-surface)_86%,transparent)] p-4 shadow-[0_18px_48px_-34px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.07)] backdrop-blur-xl sm:p-5 ${className}`}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />
      {children}
    </motion.section>
  );
}

function PlanDuration({ plan }: { plan: WeeklyPlanItem }) {
  if (plan.durationMinutes && plan.durationMinutes > 0) return <>{plan.durationMinutes} min</>;
  if (!plan.startTime || !plan.endTime) return null;
  const [sh, sm] = plan.startTime.split(":").map(Number);
  const [eh, em] = plan.endTime.split(":").map(Number);
  const minutes = eh * 60 + em - (sh * 60 + sm);
  return minutes > 0 ? <>{minutes} min</> : null;
}

function SelectedDayPanel({
  selectedDate, plans, categories, today, onSelectDay, onCreatePlan, onQuickAdd, onToggleCompleted, onEditPlan, onDeletePlan,
}: Pick<WeekHubProps, "selectedDate" | "plans" | "categories" | "onSelectDay" | "onCreatePlan" | "onQuickAdd" | "onToggleCompleted" | "onEditPlan" | "onDeletePlan"> & { today: string | null }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [optimistic, setOptimistic] = useState<WeeklyPlanItem[]>([]);
  const sequence = useRef(0);
  const reduced = useReducedMotion();
  const selectedPlans = useMemo(() => [...plans, ...optimistic].filter((plan) => plan.planDate === selectedDate).sort((a, b) => (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99")), [optimistic, plans, selectedDate]);
  const rawDateLabel = formatLocalDate(selectedDate, { weekday: "long", day: "numeric", month: "long" });
  const formattedDate = rawDateLabel.charAt(0).toLocaleUpperCase("pt-BR") + rawDateLabel.slice(1);

  const submitQuickAdd = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || saving) return;
    const category = categories.find((item) => String(item.id) === categoryId);
    const optimisticPlan: WeeklyPlanItem = {
      id: -(++sequence.current), seriesId: null, planDate: selectedDate, title: cleanTitle,
      categoryId: category?.id ?? 0,
      category: category ?? { id: 0, userId: null, name: "Plano", color: "#71d4ff", icon: null, isCustom: false, createdAt: "" },
      iconType: null, iconValue: null, color: category?.color ?? "var(--accent)", note: null,
      completedAt: null, skipped: false, startTime: time || null, endTime: null, durationMinutes: null,
      repeatType: null, repeatDays: null, isRecurring: false, reminderOffsetMin: null,
    };
    setOptimistic((items) => [...items, optimisticPlan]);
    setTitle("");
    setTime("");
    setSaving(true);
    try {
      await onQuickAdd(selectedDate, cleanTitle, optimisticPlan.startTime, category?.id);
    } catch {
      setTitle(cleanTitle);
    } finally {
      setOptimistic((items) => items.filter((item) => item.id !== optimisticPlan.id));
      setSaving(false);
    }
  };

  return (
    <GlassCard label="Planos do dia selecionado" className="md:col-span-2 xl:col-span-8 xl:row-span-2">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/[.07] text-cyan-300"><CalendarPlus size={17} /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold capitalize text-[var(--text)] sm:text-base">{formattedDate}</h2>
              {selectedDate === today && <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[.08] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-200">Hoje</span>}
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{selectedPlans.length} {selectedPlans.length === 1 ? "plano no dia" : "planos no dia"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Dia anterior" onClick={() => onSelectDay(addDays(selectedDate, -1))} className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-secondary)] transition hover:bg-white/[.06] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"><ChevronLeft size={17} /></button>
          <button type="button" aria-label="Próximo dia" onClick={() => onSelectDay(addDays(selectedDate, 1))} className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-secondary)] transition hover:bg-white/[.06] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"><ChevronRight size={17} /></button>
        </div>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={selectedDate} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: reduced ? 0 : 0.2 }} className="mt-4 min-h-[132px]">
          {selectedPlans.length ? (
            <motion.div layout className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {selectedPlans.map((plan) => {
                  const color = eventColor(plan);
                  return (
                    <motion.div key={`${plan.seriesId ?? "plan"}:${plan.id}`} layout initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: reduced ? 0 : 0.18 }}>
                      {plan.id < 0 ? <div className="flex items-center gap-2 rounded-lg border border-cyan-300/10 bg-cyan-300/[.035] px-3 py-2 text-left text-xs text-[var(--text-secondary)]"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />{plan.title}<span className="ml-auto shrink-0 text-[10px] text-cyan-200">Salvando…</span></div> : <PlanRow plan={plan} fullTitle animateCompletion onToggleCompleted={onToggleCompleted} onEdit={onEditPlan} onDelete={onDeletePlan} />}
                      <div className="-mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-10 pb-1 text-[10px] text-[var(--text-muted)]">
                        {plan.startTime && <span className="inline-flex items-center gap-1 tabular-nums"><Clock3 size={10} />{plan.startTime}</span>}
                        <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />{plan.category.name || "Plano"}</span>
                        <span className="inline-flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${plan.completedAt ? "bg-emerald-400" : "bg-cyan-400"}`} />{plan.completedAt ? "Concluído" : "Pendente"}</span>
                        <PlanDuration plan={plan} />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          ) : (
            <div className="flex min-h-[132px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[.10] bg-white/[.015] px-4 py-5 text-center">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-cyan-300/15 bg-cyan-300/[.06] text-cyan-200"><Sparkles size={17} /></span>
              <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">Um espaço em branco também é uma oportunidade.</p>
              <button type="button" onClick={() => onCreatePlan(selectedDate)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[.08] px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/[.14] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"><Focus size={14} />Planejar uma sessão de foco</button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <form onSubmit={(event) => void submitQuickAdd(event)} className="mt-4 grid grid-cols-1 gap-2 rounded-xl border border-white/[.08] bg-black/10 p-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center">
        <label className="sr-only" htmlFor="week-hub-quick-add">Adicionar plano para este dia</label>
        <input id="week-hub-quick-add" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Adicionar plano para este dia…" className="h-10 min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none" />
        <label className="sr-only" htmlFor="week-hub-time">Horário opcional</label>
        <input id="week-hub-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} aria-label="Horário opcional" className="h-9 rounded-lg border border-white/[.08] bg-[var(--bg-surface)] px-2 text-xs text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]" />
        <label className="sr-only" htmlFor="week-hub-category">Categoria opcional</label>
        <select id="week-hub-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="Categoria opcional" className="h-9 max-w-full rounded-lg border border-white/[.08] bg-[var(--bg-surface)] px-2 text-xs text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]">
          <option value="">Categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <button type="submit" disabled={!title.trim() || saving} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-300 to-blue-400 px-3 text-xs font-bold text-slate-950 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:opacity-45">{saving ? <RotateCw size={13} className="animate-spin" /> : <ArrowRight size={13} />}Adicionar</button>
      </form>
      <span className="sr-only" aria-live="polite">{saving ? "Plano sendo criado" : ""}</span>
    </GlassCard>
  );
}

function WeekSummary({ stats, today, selectedDate, onSelectDay }: { stats: WeekStats; today: string | null; selectedDate: string; onSelectDay: (date: string) => void }) {
  const reduced = useReducedMotion();
  const busiestRaw = stats.busiestDay?.total ? formatLocalDate(stats.busiestDay.date, { weekday: "long" }) : "—";
  const busiest = busiestRaw.charAt(0).toLocaleUpperCase("pt-BR") + busiestRaw.slice(1);
  const formatHours = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}` : `${minutes} min`;
  return (
    <GlassCard label="Resumo da semana" className="xl:col-start-9 xl:row-start-1">
      <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--text-faint)]">Seu ritmo</p><h2 className="mt-1 text-sm font-semibold text-[var(--text)]">Resumo da semana</h2></div><ListChecks size={17} className="text-cyan-300" /></div>
      <div className="mt-4 flex items-center gap-3">
        <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(var(--green) ${stats.percentage}%, rgba(255,255,255,.08) ${stats.percentage}% 100%)` }} role="img" aria-label={`${stats.percentage}% dos planos concluídos`}>
          <span className="grid h-[62px] w-[62px] place-items-center rounded-full bg-[var(--bg-surface)] text-lg font-extrabold tabular-nums text-[var(--text)]"><AnimatedNumber value={stats.percentage} suffix="%" duration={0.65} /></span>
        </div>
        <div><p className="text-sm font-semibold text-[var(--text)]"><AnimatedNumber value={stats.completed} duration={0.65} /> de <AnimatedNumber value={stats.total} duration={0.65} /></p><p className="text-[11px] text-[var(--text-muted)]">planos concluídos</p><p className="mt-1 text-[10px] text-[var(--text-faint)]">{stats.pending} pendente{stats.pending === 1 ? "" : "s"}</p></div>
      </div>
      <motion.div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.07]" role="progressbar" aria-label="Progresso semanal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.percentage}>
        <motion.span className="block h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-400" initial={reduced ? false : { scaleX: 0, transformOrigin: "left" }} animate={{ scaleX: stats.percentage / 100 }} transition={{ duration: reduced ? 0 : 0.7, ease: "easeOut" }} />
      </motion.div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-white/[.06] bg-white/[.025] p-2"><p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">Foco planejado</p><p className="mt-1 text-sm font-bold tabular-nums text-cyan-200">{stats.plannedMinutes ? formatHours(stats.plannedMinutes) : "—"}</p></div>
        <div className="rounded-lg border border-white/[.06] bg-white/[.025] p-2"><p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">Dia mais cheio</p><p className="mt-1 truncate text-sm font-bold capitalize text-violet-200">{busiest}</p></div>
        <div className="col-span-2 flex items-center gap-2 rounded-lg border border-white/[.06] bg-white/[.025] p-2"><span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-400/[.09] text-emerald-300"><Sparkles size={13} /></span><p className="text-[11px] text-[var(--text-secondary)]"><strong className="font-bold text-[var(--text)]">{stats.freeDaysLeft.length}</strong> dia{stats.freeDaysLeft.length === 1 ? "" : "s"} livre{stats.freeDaysLeft.length === 1 ? "" : "s"} pela frente</p></div>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1.5" aria-label="Planos por dia da semana">
        {stats.days.map((day) => {
          const height = stats.total ? Math.max(day.total ? 12 : 4, (day.total / Math.max(...stats.days.map((item) => item.total), 1)) * 42) : 4;
          return <button key={day.date} type="button" onClick={() => onSelectDay(day.date)} aria-label={`${formatLocalDate(day.date, { weekday: "long" })}: ${day.total} planos, ${day.completed} concluídos`} aria-pressed={selectedDate === day.date} className="group flex min-w-0 flex-col items-center gap-1.5 rounded-md py-1 focus-visible:outline-2 focus-visible:outline-cyan-300">
            <span className="flex h-11 w-full items-end justify-center overflow-hidden rounded-t-md bg-white/[.025]">{day.total ? <motion.span className="flex w-[65%] min-h-1 flex-col overflow-hidden rounded-t-sm" style={{ height, transformOrigin: "bottom" }} initial={reduced ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: reduced ? 0 : 0.45 }}><span className="w-full bg-emerald-400" style={{ height: `${(day.completed / day.total) * 100}%` }} /><span className="w-full flex-1 bg-cyan-400/80" /></motion.span> : null}</span>
            <span className={`text-[8px] font-semibold capitalize ${today === day.date ? "text-cyan-200" : "text-[var(--text-faint)]"}`}>{day.shortLabel}</span>
            <span className="sr-only">{day.total} planejados; {day.completed} concluídos</span>
          </button>;
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-[var(--text-faint)]"><span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />Pendente</span><span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Concluído</span><span className="ml-auto">{stats.days.map((day) => day.total).join(" · ")}</span></div>
      <p className="mt-3 min-h-8 text-[11px] leading-relaxed text-[var(--text-secondary)]" aria-live="polite">{weekProgressCopy(stats.percentage, stats.total)}</p>
    </GlassCard>
  );
}

function NextUpCard({ plan, now }: { plan: WeeklyPlanItem | null; now: Date | null }) {
  return (
    <GlassCard label="Próximo passo" className="xl:col-start-9 xl:row-start-2">
      <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-200">Próximo passo</p><h2 className="mt-1 text-sm font-semibold text-[var(--text)]">{plan ? "Um plano de cada vez" : "Tudo em dia"}</h2></div><Timer size={17} className="text-cyan-300" /></div>
      {plan ? <>
        <p className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-[var(--text)]">{plan.title}</p>
        <p className="mt-1 text-[11px] capitalize text-[var(--text-muted)]">{plan.planDate ? formatLocalDate(plan.planDate, { weekday: "long", day: "numeric", month: "long" }) : "Sem data"}{plan.startTime ? ` · ${plan.startTime}` : ""}</p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-200"><Clock3 size={12} />{now ? countdownLabel(plan, now) : "Aguardando horário local…"}</p>
        <Link href="/salas-de-foco" className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-300 to-blue-400 text-xs font-bold text-slate-950 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"><Focus size={14} />Iniciar foco</Link>
      </> : <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">Nenhum plano pendente para continuar agora. Aproveite o espaço ou planeje o próximo passo.</p>}
    </GlassCard>
  );
}

function FreeDaySuggestion({ stats, onQuickAdd, onUndoQuickAdd }: { stats: WeekStats; onQuickAdd: WeekHubProps["onQuickAdd"]; onUndoQuickAdd: WeekHubProps["onUndoQuickAdd"] }) {
  const reduced = useReducedMotion();
  const [dismissed, setDismissed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toastPlan, setToastPlan] = useState<WeeklyPlanItem | null>(null);
  const freeDays = stats.freeDaysLeft;
  const freeNames = freeDays.map((day) => formatLocalDate(day.date, { weekday: "long" }));
  const suggestion = freeDays[0];

  const addFocus = async () => {
    if (!suggestion || adding) return;
    setAdding(true);
    try {
      const created = await onQuickAdd(suggestion.date, "Sessão de foco", null);
      setToastPlan(created);
    } catch {
      // The page owns the visible error toast for failed plan creation.
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="relative min-w-0">
    <AnimatePresence initial={false}>
      {!dismissed && freeDays.length > 0 && <motion.section aria-label="Sugestão para seus dias livres" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? { opacity: 0 } : { opacity: 0, y: 5 }} transition={{ duration: reduced ? 0 : 0.2 }} className="relative flex min-w-0 flex-wrap items-center gap-3 overflow-hidden rounded-2xl border border-violet-300/[.14] bg-gradient-to-r from-violet-500/[.09] via-[var(--bg-surface)]/80 to-cyan-400/[.06] p-3.5 sm:px-4">
        <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-violet-400/10 blur-3xl" />
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-violet-300/15 bg-violet-300/[.08] text-violet-200"><Lightbulb size={17} /></span>
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[var(--text)]">{freeNames.length === 1 ? `${freeNames[0]} está livre.` : `${freeNames.slice(0, -1).join(", ")} e ${freeNames.at(-1)} estão livres.`}</p><p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">Quer planejar uma sessão de foco?</p></div>
        <button type="button" onClick={() => void addFocus()} disabled={adding} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-violet-300/20 bg-violet-300/[.1] px-3 text-[11px] font-semibold text-violet-100 transition hover:bg-violet-300/[.16] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:opacity-50"><PlusFallback />{adding ? "Adicionando…" : "Planejar foco"}</button>
        <button type="button" onClick={() => setDismissed(true)} aria-label="Dispensar sugestão" className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-faint)] transition hover:bg-white/[.06] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-cyan-300"><X size={15} /></button>
      </motion.section>}
    </AnimatePresence>
    <AnimatePresence initial={false}>{toastPlan && <motion.div role="status" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.18 }} className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-emerald-300/20 bg-[var(--bg-surface)] px-3 py-2 text-[11px] text-emerald-100"><span>Plano adicionado para {formatLocalDate(toastPlan.planDate ?? "", { weekday: "long" })}.</span><button type="button" onClick={() => { void onUndoQuickAdd(toastPlan).finally(() => setToastPlan(null)); }} className="font-bold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-emerald-300">Desfazer</button></motion.div>}</AnimatePresence>
    </div>
  );
}

function PlusFallback() { return <Plus size={13} aria-hidden="true" />; }

function WeekRecap({ plans, stats }: { plans: WeeklyPlanItem[]; stats: WeekStats }) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const completed = plans.filter((plan) => Boolean(plan.completedAt));
  const pending = plans.filter((plan) => !plan.completedAt && !plan.skipped);
  const longest = plans.reduce((best, plan) => {
    if (!`${plan.category?.name ?? ""} ${plan.title}`.toLocaleLowerCase("pt-BR").includes("foco")) return best;
    const minutes = plan.durationMinutes ?? (plan.startTime && plan.endTime ? Math.max(0, Number(plan.endTime.slice(0, 2)) * 60 + Number(plan.endTime.slice(3)) - Number(plan.startTime.slice(0, 2)) * 60 - Number(plan.startTime.slice(3))) : 0);
    return Math.max(best, minutes);
  }, 0);
  return (
    <section aria-label="Resumo da semana" className="overflow-hidden rounded-2xl border border-white/[.07] bg-[var(--bg-surface)]/55 backdrop-blur-xl">
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-cyan-300">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-300/[.07] text-cyan-200"><ListChecks size={15} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[var(--text)]">Resumo da semana</span><span className="block text-[10px] text-[var(--text-muted)]">{completed.length} concluídos · {pending.length} pendentes</span></span><ChevronDown size={15} className={`text-[var(--text-faint)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>{open && <motion.div initial={reduced ? { opacity: 0 } : { opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: reduced ? 0 : 0.22 }}><div className="border-t border-white/[.06] px-4 py-3"><ul className="grid gap-2 text-[11px] text-[var(--text-secondary)] sm:grid-cols-2"><li className="flex items-start gap-2"><Check size={13} className="mt-0.5 shrink-0 text-emerald-300" />{completed.length} {completed.length === 1 ? "plano concluído" : "planos concluídos"} nesta semana.</li>{longest > 0 && <li className="flex items-start gap-2"><Flame size={13} className="mt-0.5 shrink-0 text-amber-300" />Maior bloco de foco: {longest >= 60 ? `${Math.floor(longest / 60)}h ${longest % 60}min` : `${longest} min`}.</li>}<li className="flex items-start gap-2"><Clock3 size={13} className="mt-0.5 shrink-0 text-cyan-300" />{pending.length} {pending.length === 1 ? "plano ainda está" : "planos ainda estão"} em aberto.</li>{stats.percentage === 100 && stats.total > 0 && <li className="flex items-start gap-2"><Sparkles size={13} className="mt-0.5 shrink-0 text-violet-300" />Você concluiu tudo que planejou para esta semana.</li>}</ul></div></motion.div>}</AnimatePresence>
    </section>
  );
}

function PlansLoadingSkeleton() {
  return <div aria-label="Carregando seus planos" aria-busy="true" className="grid animate-pulse gap-3 md:grid-cols-2 xl:grid-cols-12"><div className="h-72 rounded-2xl border border-white/[.06] bg-white/[.025] md:col-span-2 xl:col-span-8 xl:row-span-2" /><div className="h-56 rounded-2xl border border-white/[.06] bg-white/[.025] md:col-span-1 xl:col-span-4" /><div className="h-44 rounded-2xl border border-white/[.06] bg-white/[.025] md:col-span-1 xl:col-span-4" /></div>;
}

export function WeekHub({ weekStart, plans, selectedDate, categories, isLoading, error, onRetry, onSelectDay, onCreatePlan, onQuickAdd, onUndoQuickAdd, onToggleCompleted, onEditPlan, onDeletePlan }: WeekHubProps) {
  const [now, setNow] = useState<Date | null>(null);
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const refresh = () => {
      const current = new Date();
      setNow(current);
      setToday(todayIso());
    };
    const initialTimeout = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 60_000);
    return () => { window.clearTimeout(initialTimeout); window.clearInterval(interval); };
  }, []);

  const stats = useMemo(() => buildWeekStats(plans, weekStart, today), [plans, today, weekStart]);
  const nextPlan = useMemo(() => {
    if (!now) return null;
    const pending = plans.filter((plan) => plan.planDate && !plan.completedAt && !plan.skipped)
      .sort((a, b) => localPlanTimestamp(a.planDate ?? "", a.startTime) - localPlanTimestamp(b.planDate ?? "", b.startTime));
    return pending.find((plan) => localPlanTimestamp(plan.planDate ?? "", plan.startTime) >= now.getTime()) ?? pending[0] ?? null;
  }, [now, plans]);

  if (isLoading && plans.length === 0) return <PlansLoadingSkeleton />;
  return (
    <section aria-label="Central da semana" className="flex min-w-0 flex-col gap-4">
      {error && <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/[.06] px-3 py-2.5 text-xs text-red-200"><span className="min-w-0 flex-1">{error}</span><button type="button" onClick={onRetry} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-300/20 px-2.5 font-semibold transition hover:bg-red-300/[.08] focus-visible:outline-2 focus-visible:outline-red-300"><RotateCw size={12} />Tentar novamente</button></div>}
      <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12 xl:gap-4">
        <SelectedDayPanel selectedDate={selectedDate} plans={plans} categories={categories} today={today} onSelectDay={onSelectDay} onCreatePlan={onCreatePlan} onQuickAdd={onQuickAdd} onToggleCompleted={onToggleCompleted} onEditPlan={onEditPlan} onDeletePlan={onDeletePlan} />
        <NextUpCard plan={nextPlan} now={now} />
        <WeekSummary stats={stats} today={today} selectedDate={selectedDate} onSelectDay={onSelectDay} />
        <div className="md:col-span-2 xl:col-span-12"><FreeDaySuggestion stats={stats} onQuickAdd={onQuickAdd} onUndoQuickAdd={onUndoQuickAdd} /></div>
        <div className="md:col-span-2 xl:col-span-12"><WeekRecap plans={plans} stats={stats} /></div>
      </div>
    </section>
  );
}
