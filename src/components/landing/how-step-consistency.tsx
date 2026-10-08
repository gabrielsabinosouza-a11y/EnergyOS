"use client";

import { useMemo, useState } from "react";
import { ConsistencyHeatmap } from "@/components/dashboard/consistency-heatmap";
import { buildActivityYear, type ActivityDay } from "@/lib/activity";
import { StaticIcon } from "./landing-assets";

const YEAR = 2026;
const TODAY = "2026-10-08";
const INITIAL = ["2026-01-03", "2026-01-12", "2026-02-06", "2026-02-15", "2026-03-02", "2026-03-18", "2026-04-04", "2026-04-19", "2026-05-07", "2026-05-22", "2026-06-03", "2026-06-17", "2026-07-08", "2026-07-21", "2026-08-02", "2026-08-14", "2026-09-03", "2026-09-19", TODAY];

export function HowStepConsistency() {
  const [active, setActive] = useState(() => new Set(INITIAL));
  const days = useMemo(() => buildActivityYear(YEAR, { today: TODAY, checkins: Object.fromEntries([...active].map((date) => [date, "success" as const])) }).map((day) => ({ ...day, future: false })), [active]);
  const streak = useMemo(() => {
    let count = 0;
    const cursor = new Date(`${TODAY}T00:00:00Z`);
    while (active.has(cursor.toISOString().slice(0, 10))) { count += 1; cursor.setUTCDate(cursor.getUTCDate() - 1); }
    return count;
  }, [active]);
  const bestStreak = useMemo(() => {
    let best = 0;
    let run = 0;
    let previous = "";
    for (const date of [...active].sort()) {
      const previousDate = previous ? new Date(`${previous}T00:00:00Z`) : null;
      const currentDate = new Date(`${date}T00:00:00Z`);
      run = previousDate && currentDate.getTime() - previousDate.getTime() === 86_400_000 ? run + 1 : 1;
      best = Math.max(best, run);
      previous = date;
    }
    return best;
  }, [active]);
  const onSelectDay = (day: ActivityDay) => setActive((current) => {
    const next = new Set(current);
    if (next.has(day.date)) next.delete(day.date); else next.add(day.date);
    return next;
  });

  return <div className="how-step how-step--map">
    <div className="how-step__kicker">CONSISTÊNCIA · Prévia ilustrativa</div>
    <h3>Seu ano em quadrados</h3>
    <div className="how-map-stats"><span><StaticIcon name="streakAlive" size={17} alt="Sequência ativa" /> <b>{streak}</b> sequência atual</span><span><b>{bestStreak}</b> melhor sequência</span></div>
    <ConsistencyHeatmap year={YEAR} days={days} today={TODAY} variant="year" showLegend accent="#71d4ff" summary={`${active.size} dias ativos em ${YEAR}`} onSelectDay={onSelectDay} />
    <p className="how-map-hint">Toque em qualquer dia para registrar ou remover um check-in.</p>
  </div>;
}
