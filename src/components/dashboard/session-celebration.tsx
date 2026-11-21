"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Flame, Play, Timer } from "lucide-react";
import { CoinIcon } from "@/components/coin-icon";
import { XpIcon } from "@/components/xp-icon";
import { AuraStageImage, StageBurst } from "@/components/aura-stage-image";
import { TiltCard } from "@/components/ui/tilt-card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { publishCoinBalance } from "@/components/coin-balance-chip";
import { api } from "@/lib/api-client";
import {
  CELEBRATION,
  celebrationCoinCount,
  type PendingCelebration,
} from "@/lib/celebration";
import { formatDurationPt } from "@/lib/design-tokens";
import { DUR, EASE, SPRING } from "@/lib/design-tokens";
import { preloadAuraStageImages } from "@/lib/aura-images";
import { ENERGY_CONFIGS, type EnergyType } from "@/lib/energy-assets";

const COIN_SRC = "/coin/coins.png";

type Phase = "finish" | "reward" | "collecting" | "done";

interface FlyingCoin {
  id: number;
  /** Random spread offset applied during the burst phase. */
  bx: number;
  by: number;
  /** Final delta from origin to the chip, in px. */
  dx: number;
  dy: number;
  /** Arc height for the curved path (negative = up). */
  arc: number;
  spin: number;
  /** Viewport coords of the burst origin (collect button center). */
  ox: number;
  oy: number;
}

/**
 * Completion celebration rendered inside the focus card. Phases:
 *   finish (~1.1s ring sweep + aura pop) → reward panel → coin flight → done.
 * The reward was already granted server-side; this is presentation only.
 */
export function SessionCelebration({
  data,
  accentColor,
  onDone,
}: {
  data: PendingCelebration;
  accentColor: string;
  onDone: () => void;
}) {
  const reduced = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<Phase>("finish");
  const [coins, setCoins] = useState<FlyingCoin[]>([]);
  const landedRef = useRef(0);
  const collectBtnRef = useRef<HTMLButtonElement | null>(null);
  const doneRef = useRef(false);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Exact server balance fetched when the celebration starts. */
  const endBalanceRef = useRef<number | null>(null);
  const startBalanceRef = useRef<number | null>(null);

  const auraId = data.auraId ?? null;
  const cfg = auraId ? ENERGY_CONFIGS[auraId as EnergyType] : undefined;
  const coinTotal = celebrationCoinCount(data.coins);
  const streakChanged =
    typeof data.streakPrevious === "number" &&
    typeof data.streakCurrent === "number" &&
    data.streakCurrent !== data.streakPrevious;

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);

  // ── Phase 1: finish moment → reward panel ──────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setPhase("reward"), reduced ? DUR.base : CELEBRATION.finishMs);
    return () => clearTimeout(t);
  }, [reduced]);

  // Preload the full aura + coin sprite as soon as the celebration mounts.
  useEffect(() => {
    if (auraId) preloadAuraStageImages(auraId, cfg);
    const img = new window.Image();
    img.src = COIN_SRC;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auraId]);

  // Fetch the authoritative balance once so the chip lands EXACTLY on it.
  useEffect(() => {
    let cancelled = false;
    api.getSettings()
      .then((s) => {
        if (cancelled) return;
        endBalanceRef.current = s.coins;
        startBalanceRef.current = Math.max(0, s.coins - data.coins);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [data.coins]);

  // Focus the collect button when the reward panel appears (a11y).
  useEffect(() => {
    if (phase === "reward") collectBtnRef.current?.focus();
  }, [phase]);

  // Esc / "Pular animação" → identical end state.
  useEffect(() => {
    if (phase === "done") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skipToEnd();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Auto-collect after ~8s so the user is never stuck on the reward panel.
  useEffect(() => {
    if (phase !== "reward") return;
    const t = setTimeout(() => startCollect(), CELEBRATION.autoCollectMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Safety net: if the tab was hidden mid-flight, animations may never fire
  // their completion callbacks — force the end state after a hard timeout.
  useEffect(() => {
    if (phase !== "collecting") return;
    const total =
      CELEBRATION.burstMs +
      CELEBRATION.flightMs +
      coinTotal * CELEBRATION.staggerMs +
      1200;
    safetyTimer.current = setTimeout(() => {
      publishFinalBalance();
      setPhase("done");
      setTimeout(finish, reduced ? 0 : DUR.slow * 1000);
    }, total);
    return () => { if (safetyTimer.current) clearTimeout(safetyTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, coinTotal, reduced]);

  function publishFinalBalance() {
    const end = endBalanceRef.current;
    if (end !== null) publishCoinBalance(end);
  }

  /** Skip animation → same final state (balance published, panel closes). */
  function skipToEnd() {
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    publishFinalBalance();
    setPhase("done");
    setTimeout(finish, reduced ? 0 : DUR.slow * 1000);
  }

  /** Launch the coin flight toward the global header chip. */
  function startCollect() {
    if (phase !== "reward" || doneRef.current) return;
    if (coinTotal === 0 || reduced || data.coins <= 0) {
      // Zero-coin edge case (or reduced motion): no flight, just settle.
      publishFinalBalance();
      setPhase("done");
      setTimeout(finish, reduced ? 0 : DUR.base * 1000);
      return;
    }

    // Measure the target at animation time (handles scroll/resize correctly
    // because the rect is read right before the flight starts).
    const chip = document.getElementById("energyos-coin-chip");
    const chipRect = chip?.getBoundingClientRect();
    const btn = collectBtnRef.current;
    const btnRect = btn?.getBoundingClientRect();
    const originX = btnRect ? btnRect.left + btnRect.width / 2 : window.innerWidth / 2;
    const originY = btnRect ? btnRect.top + btnRect.height / 2 : window.innerHeight / 2;
    const targetX = chipRect ? chipRect.left + chipRect.width / 2 : window.innerWidth - 80;
    const targetY = chipRect ? chipRect.top + chipRect.height / 2 : 40;

    const list: FlyingCoin[] = Array.from({ length: coinTotal }, (_, i) => ({
      id: i,
      bx: (Math.random() - 0.5) * 90,
      by: -(30 + Math.random() * 70),
      dx: targetX - originX + (Math.random() - 0.5) * 24,
      dy: targetY - originY + (Math.random() - 0.5) * 16,
      arc: -(70 + Math.random() * 80),
      spin: 360 + Math.random() * 720,
      ox: originX,
      oy: originY,
    }));
    setCoins(list);
    landedRef.current = 0;
    setPhase("collecting");
  }

  /** Called when each coin lands: step the balance up, land exactly on the
      server value with the last coin. */
  const onCoinLand = useCallback(() => {
    landedRef.current += 1;
    const next = landedRef.current;
    const end = endBalanceRef.current;
    const start = startBalanceRef.current;
    if (end !== null) {
      if (next >= coinTotal) {
        publishCoinBalance(end); // land EXACTLY on the server balance
      } else if (start !== null) {
        publishCoinBalance(Math.round(start + (end - start) * (next / coinTotal)));
      }
    }
    if (next >= coinTotal) {
      // All coins landed — settle into done after a short beat.
      setTimeout(() => {
        publishFinalBalance();
        setPhase("done");
        setTimeout(finish, reduced ? 0 : DUR.slow * 1000);
      }, 250);
    }
  }, [coinTotal, finish, reduced]);

  const announcement = useMemo(
    () =>
      `Sessão concluída. Você ganhou ${data.coins} moedas e ${data.xp} XP.`,
    [data.coins, data.xp],
  );

  return (
    <div className="relative flex w-full flex-col items-center">
      {/* Screen-reader announcement */}
      <div aria-live="polite" role="status" className="sr-only">
        {phase !== "finish" ? announcement : ""}
      </div>

      <AnimatePresence mode="wait">
        {phase === "finish" && (
          <motion.div
            key="finish"
            className="flex flex-col items-center gap-4 py-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: DUR.base }}
          >
            {/* Ring sweep */}
            <div className="relative" style={{ width: 180, height: 180 }}>
              <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
                <circle cx="90" cy="90" r="82" fill="none" stroke="var(--border-subtle)" strokeWidth="6" opacity="0.4" />
                <motion.circle
                  cx="90" cy="90" r="82" fill="none"
                  stroke={accentColor} strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 82}
                  initial={{ strokeDashoffset: 2 * Math.PI * 82 }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ duration: reduced ? 0.2 : CELEBRATION.finishMs / 1000, ease: EASE.out }}
                  style={{ filter: "drop-shadow(0 0 8px var(--accent-glow))" }}
                />
              </svg>
              {/* Shockwave ring */}
              {!reduced && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2"
                  style={{ borderColor: accentColor }}
                  initial={{ scale: 0.6, opacity: 0.8 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 0.9, ease: EASE.out }}
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  initial={reduced ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={SPRING.bouncy}
                >
                  <AuraStageImage
                    auraId={auraId ?? "flame"}
                    stage="full"
                    cfg={cfg}
                    label={cfg?.label ?? "aura"}
                    size={104}
                  />
                </motion.div>
              </div>
              {!reduced && <StageBurst kind="big" />}
            </div>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)]"
            >
              Sessão concluída!
            </motion.p>
          </motion.div>
        )}

        {phase === "reward" && (
          <motion.div
            key="reward"
            className="flex w-full flex-col items-center gap-4 py-4"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={SPRING.smooth}
          >
            <TiltCard className="relative flex flex-col items-center">
              {/* soft glow + float */}
              <motion.div
                animate={reduced ? undefined : { y: [0, -7, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                className="relative flex items-center justify-center rounded-3xl px-8 py-6"
                style={{
                  background: `radial-gradient(circle at 50% 60%, ${accentColor}26, transparent 70%)`,
                  boxShadow: `0 0 60px -12px ${accentColor}55`,
                }}
              >
                <AuraStageImage
                  auraId={auraId ?? "flame"}
                  stage="full"
                  cfg={cfg}
                  label={cfg?.label ?? "aura"}
                  size={120}
                />
              </motion.div>
            </TiltCard>

            <div className="text-center">
              <h3 className="font-display text-xl font-semibold tracking-tight text-[var(--text)]">
                Sessão concluída!
              </h3>
              <p className="mt-0.5 flex items-center justify-center gap-1.5 text-xs text-[var(--text-muted)]">
                <Timer size={12} />
                {formatDurationPt(data.durationMinutes)} de foco
              </p>
            </div>

            {/* Reward chips with count-up */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...SPRING.bouncy, delay: 0.12 }}
                className="flex items-center gap-1.5 rounded-full border border-[#ffb86b]/40 bg-[#ffb86b]/10 px-3.5 py-1.5"
              >
                <CoinIcon size={16} />
                <AnimatedNumber
                  value={data.coins}
                  className="font-mono text-base font-bold tabular-nums text-[#ffb86b]"
                />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#ffb86b]/80">moedas</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...SPRING.bouncy, delay: 0.2 }}
                className="flex items-center gap-1.5 rounded-full border border-[var(--accent)]/40 bg-[var(--accent-bg)] px-3.5 py-1.5"
              >
                <XpIcon size={14} />
                <AnimatedNumber
                  value={data.xp}
                  className="font-mono text-base font-bold tabular-nums text-[var(--accent)]"
                />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">XP</span>
              </motion.div>
              {streakChanged && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...SPRING.bouncy, delay: 0.28 }}
                  className="flex items-center gap-1.5 rounded-full border border-orange-400/40 bg-orange-400/10 px-3.5 py-1.5"
                >
                  <Flame size={14} className="text-orange-300" />
                  <AnimatedNumber
                    value={data.streakCurrent ?? 0}
                    className="font-mono text-base font-bold tabular-nums text-orange-300"
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-300/80">
                    {data.streakCurrent! > data.streakPrevious! ? "sequência" : "dias"}
                  </span>
                </motion.div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col items-center gap-2.5">
              <motion.button
                ref={collectBtnRef}
                whileTap={{ scale: 0.97 }}
                onClick={startCollect}
                className="rounded-full px-8 py-3 text-sm font-bold text-[var(--bg-primary)] transition-shadow hover:shadow-[0_0_36px_-6px_var(--accent-glow)]"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 70%, #ffb86b))`,
                  boxShadow: `0 0 28px -8px ${accentColor}aa`,
                }}
              >
                {data.coins > 0 ? "Coletar moedas" : "Concluir"}
              </motion.button>
              <div className="flex items-center gap-4">
                <button
                  onClick={skipToEnd}
                  className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                >
                  Pular animação
                </button>
                <button
                  onClick={finish}
                  className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                >
                  <Play size={11} /> Nova sessão
                </button>
                <button
                  onClick={finish}
                  className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                >
                  Descansar 5 min
                </button>
              </div>
            </div>
            <p className="text-[10px] text-[var(--text-faint)]">Esc para pular</p>
          </motion.div>
        )}

        {phase === "collecting" && (
          <motion.div
            key="collecting"
            className="flex flex-col items-center gap-4 py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="text-sm font-bold text-[var(--text-secondary)]">Moedas a caminho…</p>
          </motion.div>
        )}

        {phase === "done" && (
          <motion.div
            key="done"
            className="flex flex-col items-center gap-3 py-8"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: DUR.base }}
          >
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 0.5 }}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--green)]/40 bg-[var(--green-bg)]"
            >
              <CoinIcon size={26} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flying coins overlay — fixed, above everything, pointer-transparent */}
      <AnimatePresence>
        {phase === "collecting" &&
          coins.map((coin, i) => (
            <FlyingCoinSprite
              key={coin.id}
              coin={coin}
              index={i}
              onLand={onCoinLand}
            />
          ))}
      </AnimatePresence>
    </div>
  );
}

/** A single coin: bursts out with random spread, hangs, then curves to chip. */
function FlyingCoinSprite({
  coin,
  index,
  onLand,
}: {
  coin: FlyingCoin;
  index: number;
  onLand: () => void;
}) {
  const landedRef = useRef(false);
  const delay = index * CELEBRATION.staggerMs / 1000;
  const total = (CELEBRATION.burstMs + CELEBRATION.flightMs) / 1000;
  const burstT = CELEBRATION.burstMs / (CELEBRATION.burstMs + CELEBRATION.flightMs);

  return (
    <motion.div
      className="pointer-events-none fixed z-[300]"
      style={{ left: coin.ox, top: coin.oy }}
      initial={{ x: coin.bx * 0.4, y: coin.by * 0.4, opacity: 0, scale: 0.4, rotateY: 0 }}
      animate={{
        // burst out → hang → curve to target
        x: [coin.bx * 0.4, coin.bx, coin.dx * 0.6, coin.dx],
        y: [coin.by * 0.4, coin.by, coin.dy * 0.55 + coin.arc, coin.dy],
        opacity: [0, 1, 1, 1],
        scale: [0.4, 1.05, 1, 0.9],
        rotateY: [0, coin.spin * 0.5, coin.spin],
      }}
      transition={{
        duration: total,
        delay,
        times: [0, burstT * 0.45, burstT, 1],
        ease: [EASE.arc, EASE.arc, EASE.inOut],
      }}
      onAnimationComplete={() => {
        if (landedRef.current) return;
        landedRef.current = true;
        onLand();
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- animated sprite, next/image can't tween transforms cheaply */}
      <img
        src={COIN_SRC}
        alt=""
        width={26}
        height={26}
        draggable={false}
        style={{
          width: 26,
          height: 26,
          objectFit: "contain",
          filter: "drop-shadow(0 0 6px rgba(255,184,107,.8))",
          transformStyle: "preserve-3d",
        }}
      />
    </motion.div>
  );
}
