"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Leaf, ChevronLeft, ChevronRight, Sprout, Timer, Grid3X3, List } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/navigation";
import { useAuthRedirect, useAuth } from "@/lib/auth-context";
import { getGardenEntries } from "@/lib/garden-store";
import { api } from "@/lib/api-client";
import { ENERGY_CONFIGS, mapGrowthStageToEnergyStage } from "@/lib/energy-assets";
import { IsometricGarden } from "@/components/isometric-garden";
import type { GardenEntry } from "@/lib/db/focus";

type Period = "day" | "week" | "month" | "year";

const PERIOD_TABS: { key: Period; label: string }[] = [
  { key: "day", label: "Dia" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "year", label: "Ano" },
];

const EMPTY_TEXT: Record<Period, string> = {
  day: "Nenhuma energia plantada neste dia.",
  week: "Nenhuma energia plantada nesta semana.",
  month: "Nenhuma energia plantada neste mês.",
  year: "Nenhuma energia plantada neste ano.",
};

const WEEKDAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.03 } } };
const fadeUp = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

// ── Period math ───────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

interface PeriodRange {
  start: Date;
  end: Date;
  label: string;
}

function getPeriodRange(period: Period, anchor: Date): PeriodRange {
  if (period === "day") {
    const start = startOfDay(anchor);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    const label = start.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    return { start, end, label };
  }
  if (period === "week") {
    const start = startOfWeek(anchor);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    const last = new Date(end.getTime() - 1);
    const sameMonth = start.getMonth() === last.getMonth();
    const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: sameMonth ? undefined : "short" });
    const label = `${fmt(start)} – ${fmt(last)} de ${last.getFullYear()}`;
    return { start, end, label };
  }
  if (period === "month") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    const label = start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return { start, end, label };
  }
  const start = new Date(anchor.getFullYear(), 0, 1);
  const end = new Date(anchor.getFullYear() + 1, 0, 1);
  return { start, end, label: String(anchor.getFullYear()) };
}

function shiftAnchor(period: Period, anchor: Date, dir: 1 | -1): Date {
  const next = new Date(anchor);
  if (period === "day") next.setDate(next.getDate() + dir);
  else if (period === "week") next.setDate(next.getDate() + 7 * dir);
  else if (period === "month") {
    next.setDate(1);
    next.setMonth(next.getMonth() + dir);
  } else {
    next.setFullYear(next.getFullYear() + dir);
  }
  return next;
}

function rangeIsCurrent(period: Period, anchor: Date): boolean {
  const now = new Date();
  if (period === "day") return startOfDay(now).getTime() === startOfDay(anchor).getTime();
  if (period === "week") return startOfWeek(now).getTime() === startOfWeek(anchor).getTime();
  if (period === "month") return now.getFullYear() === anchor.getFullYear() && now.getMonth() === anchor.getMonth();
  return now.getFullYear() === anchor.getFullYear();
}

// ── Distribution chart data ───────────────────────────────────────────────────

interface BarDatum {
  label: string;
  fullLabel: string;
  minutes: number;
}

function buildChartData(period: Period, entries: GardenEntry[], range: PeriodRange): BarDatum[] {
  if (period === "day") {
    const buckets = Array.from({ length: 24 }, (_, h) => ({
      label: String(h).padStart(2, "0"),
      fullLabel: `${String(h).padStart(2, "0")}:00`,
      minutes: 0,
    }));
    for (const e of entries) buckets[new Date(e.plantedAt).getHours()].minutes += e.durationMinutes;
    return buckets;
  }
  if (period === "week") {
    const buckets = WEEKDAY_SHORT.map((label) => ({ label, fullLabel: label, minutes: 0 }));
    for (const e of entries) buckets[(new Date(e.plantedAt).getDay() + 6) % 7].minutes += e.durationMinutes;
    return buckets;
  }
  if (period === "month") {
    const start = range.start;
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const buckets = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const full = new Date(start.getFullYear(), start.getMonth(), day);
      return {
        label: String(day),
        fullLabel: full.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        minutes: 0,
      };
    });
    for (const e of entries) {
      const d = new Date(e.plantedAt);
      if (d.getMonth() === start.getMonth()) buckets[d.getDate() - 1].minutes += e.durationMinutes;
    }
    return buckets;
  }
  const buckets = MONTH_SHORT.map((label) => ({ label, fullLabel: label, minutes: 0 }));
  for (const e of entries) buckets[new Date(e.plantedAt).getMonth()].minutes += e.durationMinutes;
  return buckets;
}

function labelStepFor(period: Period, len: number): number {
  if (period === "day") return 3;
  if (period === "month") return Math.max(1, Math.ceil(len / 7));
  return 1;
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Bar chart ─────────────────────────────────────────────────────────────────

function DistributionChart({ data, labelStep, height = 168 }: { data: BarDatum[]; labelStep: number; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.minutes));
  return (
    <div className="flex flex-col">
      <div className="flex items-end gap-[2px] sm:gap-1" style={{ height }}>
        {data.map((d, i) => {
          const pct = (d.minutes / max) * 100;
          return (
            <div key={`${i}-${d.label}`} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1 text-[10px] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                <span className="font-semibold text-[var(--text)]">
                  {d.fullLabel}: {d.minutes}min
                </span>
              </div>
              <motion.div
                key={`${i}-${d.label}`}
                initial={{ height: 0 }}
                animate={{ height: `${pct}%` }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                className="w-full max-w-[26px] rounded-t-[3px]"
                style={{
                  background: "linear-gradient(180deg, #71d4ff 0%, rgba(113,212,255,.28) 100%)",
                  opacity: d.minutes === 0 ? 0.12 : 0.92,
                  boxShadow: d.minutes > 0 ? "0 0 12px -2px rgba(113,212,255,.5)" : "none",
                  minHeight: d.minutes > 0 ? 6 : 0,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex">
        {data.map((d, i) => (
          <div
            key={`x-${i}`}
            className="flex-1 truncate text-center font-mono text-[9px] leading-tight text-[var(--text-faint)]"
            style={{ opacity: i % labelStep === 0 ? 1 : 0 }}
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JardimPage() {
  const { loading } = useAuthRedirect({ ifGuest: "/" });
  const { user } = useAuth();
  const [entries, setEntries] = useState<GardenEntry[]>([]);
  const [gardenLoading, setGardenLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<"garden" | "list">("garden");
  const [selectedEntry, setSelectedEntry] = useState<GardenEntry | null>(null);

  // Load garden entries from the DB (authoritative). Also migrates any legacy
  // localStorage garden entries into the DB once (idempotent via legacy_key).
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;

    const load = async () => {
      try {
        const legacy = getGardenEntries();
        if (legacy.length > 0) {
          await api.importGarden(
            legacy.map((e) => ({
              legacyKey: e.id,
              energyType: e.energyType as string,
              durationMinutes: e.durationMinutes,
              reward: e.reward,
              plantedAt: e.plantedAt,
            })),
          );
        }
        const { entries: dbEntries } = await api.getGarden();
        if (!cancelled) setEntries(dbEntries);
      } catch {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setGardenLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [loading, user]);


  const range = useMemo(() => getPeriodRange(period, anchor), [period, anchor]);

  const periodEntries = useMemo(() => {
    const start = range.start.getTime();
    const end = range.end.getTime();
    return entries.filter((e) => {
      const t = new Date(e.plantedAt).getTime();
      return t >= start && t < end;
    });
  }, [entries, range]);

  const totalMinutes = periodEntries.reduce((acc, e) => acc + e.durationMinutes, 0);
  const chartData = useMemo(() => buildChartData(period, periodEntries, range), [period, periodEntries, range]);
  const chartLabelStep = labelStepFor(period, chartData.length);
  const isCurrent = rangeIsCurrent(period, anchor);

  const selectPeriod = (p: Period) => {
    setPeriod(p);
    setAnchor(new Date());
  };

  if (loading) return null;

  return (
    <AppShell>
      <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <Header eyebrow="JARDIM" title="Meu jardim" />

          {gardenLoading && (
            <div className="panel p-12 flex flex-col items-center gap-3 text-center">
              <Leaf size={32} className="text-[var(--text-faint)] animate-pulse" />
              <p className="text-sm text-[var(--text-muted)]">Carregando seu jardim…</p>
            </div>
          )}

          {!gardenLoading && (
            <>
          {/* Period tabs */}
          <div className="mb-3 flex w-fit items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-1">
            {PERIOD_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => selectPeriod(t.key)}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
                  period === t.key
                    ? "bg-[var(--accent)] text-[var(--bg-primary)] shadow-[0_0_16px_-2px_var(--accent-glow)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* View mode toggle */}
          <div className="mb-6 flex justify-end">
            <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-1">
              <button
                type="button"
                onClick={() => setViewMode("garden")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "garden"
                    ? "bg-[var(--accent)] text-[var(--bg-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <Grid3X3 size={14} className="inline mr-1" />
                Jardim
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-[var(--accent)] text-[var(--bg-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <List size={14} className="inline mr-1" />
                Lista
              </button>
            </div>
          </div>

          {/* Date navigator */}
          <div className="mb-8 flex items-center justify-center gap-3">
            <button
              type="button"
              aria-label="Período anterior"
              onClick={() => setAnchor((a) => shiftAnchor(period, a, -1))}
              className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--accent)]"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="min-w-[180px] text-center font-mono text-sm font-semibold text-[var(--text-secondary)]">
              {range.label}
            </div>
            <button
              type="button"
              aria-label="Próximo período"
              onClick={() => setAnchor((a) => shiftAnchor(period, a, 1))}
              className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--accent)]"
            >
              <ChevronRight size={16} />
            </button>
            {!isCurrent && (
              <button
                type="button"
                onClick={() => setAnchor(new Date())}
                className="rounded-lg border border-dashed border-[var(--border-strong)] px-2.5 py-1.5 text-[10px] font-semibold text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                Atual
              </button>
            )}
          </div>

          {/* Counters */}
          <div className="mb-8 grid grid-cols-2 gap-3">
            <div className="panel p-4 text-center">
              <div className="text-2xl font-mono font-bold text-[var(--accent)]">{periodEntries.length}</div>
              <div className="text-[10px] text-[var(--text-faint)] mt-0.5 uppercase tracking-wider">energias plantadas</div>
            </div>
            <div className="panel p-4 text-center">
              <div className="text-2xl font-mono font-bold text-[#ffb86b]">{formatMinutes(totalMinutes)}</div>
              <div className="text-[10px] text-[var(--text-faint)] mt-0.5 uppercase tracking-wider">minutos de foco</div>
            </div>
          </div>

          {/* Garden view */}
          <motion.section
            key={`garden-${period}-${range.start.getTime()}-${viewMode}`}
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="mb-8"
          >
            <div className="mb-3 flex items-center gap-2">
              <SpriteLine count={periodEntries.length} />
            </div>

            {periodEntries.length === 0 ? (
              <div className="panel p-12 flex flex-col items-center gap-3 text-center">
                <Leaf size={32} className="text-[var(--text-faint)]" />
                <p className="text-sm text-[var(--text-muted)]">{EMPTY_TEXT[period]}</p>
                <p className="text-xs text-[var(--text-faint)]">Complete uma sessão de foco para plantar sua primeira energia.</p>
              </div>
            ) : viewMode === "garden" ? (
              <IsometricGarden
                entries={periodEntries}
                onEntryClick={setSelectedEntry}
                className="min-h-[300px]"
              />
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {periodEntries.map((entry) => {
                  const cfg = ENERGY_CONFIGS[entry.energyType];
                  if (!cfg) {
                    if (process.env.NODE_ENV !== "production") {
                      throw new Error(`Unknown garden energy type: ${entry.energyType}`);
                    }
                    return null;
                  }
                  const energyStage = mapGrowthStageToEnergyStage(entry.growthStage, entry.status);
                  const planted = new Date(entry.plantedAt);
                  const date = planted.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                  const datetime = planted.toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const isWithered = entry.status === "withered";
                  const isGrowing = entry.status === "growing";

                  return (
                    <motion.div
                      key={entry.id}
                      variants={fadeUp}
                      className="group relative flex flex-col items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3"
                      style={{
                        boxShadow: `0 0 16px -6px ${cfg.glow}`,
                        opacity: isWithered ? 0.6 : 1,
                      }}
                      onClick={() => setSelectedEntry(entry)}
                    >
                      {/* Status indicator */}
                      {isGrowing && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                      )}
                      {isWithered && (
                        <div className="absolute -top-1 -right-1 text-xs">🥀</div>
                      )}

                      {/* Tooltip */}
                      <div className="pointer-events-none absolute -top-2 left-1/2 z-20 hidden -translate-x-1/2 -translate-y-full flex-col items-center gap-0.5 whitespace-nowrap rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-center shadow-xl group-hover:flex">
                        <span className="text-[10px] font-bold" style={{ color: cfg.accent }}>{cfg.label}</span>
                        <span className="text-[9px] text-[var(--text-muted)]">plantada em {datetime}</span>
                        <span className="text-[9px] text-[var(--text-faint)]">{entry.durationMinutes}min de foco</span>
                        {isWithered && <span className="text-[9px] text-red-400">Sessão abandonada</span>}
                        {isGrowing && <span className="text-[9px] text-[var(--accent)]">Crescendo...</span>}
                      </div>

                      <div className="relative h-14 w-14">
                        <Image
                          src={cfg.assets[energyStage]}
                          alt={cfg.label}
                          fill
                          style={{
                            objectFit: "contain",
                            filter: isWithered ? "grayscale(100%) brightness(0.7)" : "none",
                          }}
                          unoptimized
                        />
                      </div>
                      <span className="text-[10px] font-medium text-[var(--text-secondary)]" style={{ color: cfg.accent }}>
                        {cfg.label}
                      </span>
                      <span className="text-[9px] text-[var(--text-faint)]">{date}</span>
                      <span className="text-[9px] text-[var(--text-faint)]">{entry.durationMinutes}min</span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.section>

          {/* Focused time distribution */}
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="panel p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Timer size={15} className="text-[var(--accent)]" />
                  <span className="eyebrow">DISTRIBUIÇÃO DE TEMPO FOCADO</span>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2.5 py-1">
                  <Timer size={11} className="text-[#ffb86b]" />
                  <span className="font-mono text-[10px] font-bold text-[#ffb86b]">{formatMinutes(totalMinutes)}</span>
                </div>
              </div>
              <DistributionChart data={chartData} labelStep={chartLabelStep} />
              <p className="mt-3 text-center text-[10px] text-[var(--text-faint)]">
                {period === "day"
                  ? "Minutos de foco por hora do dia"
                  : period === "week"
                    ? "Minutos de foco por dia da semana"
                    : period === "month"
                      ? "Minutos de foco por dia do mês"
                      : "Minutos de foco por mês"}
              </p>
            </div>
          </motion.section>
            </>
          )}

          {/* Entry detail popup */}
          <AnimatePresence>
            {selectedEntry && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                onClick={() => setSelectedEntry(null)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="panel max-w-sm w-full p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  {(() => {
                    const cfg = ENERGY_CONFIGS[selectedEntry.energyType];
                    if (!cfg) {
                      if (process.env.NODE_ENV !== "production") {
                        throw new Error(`Unknown garden energy type: ${selectedEntry.energyType}`);
                      }
                      return null;
                    }
                    const energyStage = mapGrowthStageToEnergyStage(selectedEntry.growthStage, selectedEntry.status);
                    const planted = new Date(selectedEntry.plantedAt);
                    const datetime = planted.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const isWithered = selectedEntry.status === "withered";
                    const isGrowing = selectedEntry.status === "growing";

                    return (
                      <>
                        <div className="flex flex-col items-center gap-4">
                          <div className="relative h-24 w-24">
                            <Image
                              src={cfg.assets[energyStage]}
                              alt={cfg.label}
                              fill
                              style={{
                                objectFit: "contain",
                                filter: isWithered ? "grayscale(100%) brightness(0.7)" : "none",
                              }}
                              unoptimized
                            />
                          </div>

                          <div className="text-center">
                            <h3 className="text-lg font-bold" style={{ color: cfg.accent }}>
                              {cfg.label}
                            </h3>
                            <div className="mt-2 space-y-1">
                              <p className="text-sm text-[var(--text-muted)]">
                                Plantada em {datetime}
                              </p>
                              <p className="text-sm text-[var(--text-muted)]">
                                {selectedEntry.durationMinutes}min de foco
                              </p>
                              <div className="flex items-center justify-center gap-2 mt-2">
                                {isGrowing && (
                                  <span className="text-xs px-2 py-1 rounded-full bg-[var(--accent)] text-[var(--bg-primary)]">
                                    Crescendo...
                                  </span>
                                )}
                                {isWithered && (
                                  <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400">
                                    🥀 Murcha
                                  </span>
                                )}
                                {selectedEntry.status === "alive" && (
                                  <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                                    ✓ Viva
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => setSelectedEntry(null)}
                            className="mt-4 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-surface-active)] transition-colors"
                          >
                            Fechar
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </AppShell>
  );
}

function SpriteLine({ count }: { count: number }) {
  return (
    <>
      <Sprout size={15} className="text-[#6bffb8]" />
      <span className="eyebrow">PLANTADAS NO PERÍODO</span>
      <span className="ml-auto font-mono text-[10px] text-[var(--text-faint)]">{count}</span>
    </>
  );
}