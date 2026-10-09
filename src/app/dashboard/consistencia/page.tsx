"use client";

import { useState } from "react";
import { AlertCircle, CalendarCheck, ChevronLeft, ChevronRight, Flame, Loader2, Target, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { HabitTracker } from "@/components/dashboard/habit-tracker";
import { Heatmap } from "@/components/dashboard/heatmap";
import { StatCard } from "@/components/dashboard/stat-card";
import { StreakIcon } from "@/components/streak-icon";
import Image from "next/image";
import { useAuthRedirect } from "@/lib/auth-context";
import { useActivityHistory } from "@/lib/use-activity-history";
import { todayIso } from "@/lib/db/dates";
import { AnimatePresence, motion } from "framer-motion";

export default function ConsistenciaPage() {
  const { user, loading } = useAuthRedirect({ ifGuest: "/" });
  const currentYear = Number(todayIso().slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const { days, stats, loading: loadingHistory, error } = useActivityHistory(year, !loading && Boolean(user));

  if (loading || !user || loadingHistory) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[#71d4ff]" />
        </div>
      </AppShell>
    );
  }

  const isCurrentYear = year === currentYear;
  const streakHint = isCurrentYear ? "dias consecutivos até hoje" : `sequência encerrada em 31/12/${year}`;

  return (
    <AppShell>
      <main className="min-h-screen px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
        <header className="mb-8">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[.2em] text-[#71d4ff]">CONSISTÊNCIA</p>
            <h1 className="font-display text-3xl tracking-[-.04em] sm:text-4xl">
              Sua constância<span className="text-[#ffb86b]">.</span>
            </h1>
          </div>
        </header>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        <div className="space-y-8">
          <section className="consistency-stats-grid grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
              label="Sequência atual"
              value={stats.current}
              hint={streakHint}
              icon={Flame}
              iconContent={<StreakIcon size={32} variant="saved" />}
              color="#ffb86b"
            />
            <StatCard
              label="Melhor sequência"
              value={stats.best}
              hint={`recorde de ${year}`}
              icon={TrendingUp}
              iconContent={<Image src="/icons_8bits/graph.png" alt="" width={32} height={32} unoptimized />}
              color="#71d4ff"
            />
            <StatCard
              label="Dias ativos"
              value={stats.activeDays}
              hint={`${stats.rate}% dos ${stats.elapsedDays} dias do ano até agora`}
              icon={CalendarCheck}
              iconContent={<Image src="/icons_8bits/calendar.png" alt="" width={32} height={32} unoptimized />}
              color="#6bffb8"
            />
            <StatCard
              label="Hábitos completados"
              value={stats.dailyTaskEntries}
              hint="check-ins de hábitos no ano"
              icon={Target}
              iconContent={<Image src="/icons_8bits/target.png" alt="" width={32} height={32} unoptimized />}
              color="#b69cff"
            />
          </section>

          <section className="consistency-map-card panel rounded-2xl p-5 sm:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-full bg-[#71d4ff]/20 p-2.5" style={{ boxShadow: "0 0 0 2px rgba(113,212,255,0.35), 0 0 12px rgba(113,212,255,0.4), inset 0 0 8px rgba(113,212,255,0.2)" }}>
                <Image src="/icons_8bits/map.png" alt="" width={32} height={32} unoptimized />
              </div>
              <div>
                <h2 className="font-display text-xl">Mapa do ano</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Cada quadrado é um dia — quanto mais intenso, mais você fez (check-in + hábitos).
                </p>
              </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-black/10 p-1">
                <button type="button" onClick={() => setYear((y) => y - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text)]" aria-label="Ano anterior"><ChevronLeft size={17} /></button>
                <span className="min-w-[4.5rem] text-center font-display text-base">{year}</span>
                <button type="button" onClick={() => setYear((y) => Math.min(currentYear, y + 1))} disabled={year >= currentYear} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-35" aria-label="Próximo ano"><ChevronRight size={17} /></button>
              </div>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={year} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.18 }}>
                <Heatmap year={year} days={days} today={todayIso()} />
              </motion.div>
            </AnimatePresence>
          </section>

          <HabitTracker year={year} />
        </div>
      </main>
    </AppShell>
  );
}
