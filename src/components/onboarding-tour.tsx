"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Bell, Sun, Target, Leaf, Trophy, Zap } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { requestNotificationPermission } from "@/lib/reminders";
import { useSeason } from "@/components/seasonal/season-provider";
import { TourHeroStage } from "@/components/tour/tour-hero-stage";
import { GlassCard } from "@/components/tour/glass-card";

interface Step {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  img?: string;
  href?: string;
  actions?: boolean;
  accent: string;
}

const STEPS: Step[] = [
  {
    icon: <Sun size={18} />,
    eyebrow: "BOAS-VINDAS",
    title: "energyOS",
    body: "Seu painel de energia, foco e consistência. Aqui, cada hábito vira progresso — e cada foco planta algo novo.",
    img: "/icons_8bits/logo.png",
    accent: "#60a5fa",
  },
  {
    icon: <Zap size={18} />,
    eyebrow: "CHECK-IN DIÁRIO",
    title: "Comece pelo seu ritmo",
    body: "Registre sono, estudo, treino e energia todos os dias. O check-in alimenta seus indicadores e mantém a consistência.",
    img: "/Onboard/Check_diario.png",
    href: "/dashboard",
    accent: "#22d3ee",
  },
  {
    icon: <Target size={18} />,
    eyebrow: "FOCO",
    title: "Dê o primeiro passo: foque",
    body: "Use o timer ou entre em uma sala de foco. Cada sessão concluída rende XP, moedas e conta para o seu streak — do painel ou da sala.",
    img: "/Onboard/focus.png",
    href: "/salas-de-foco",
    accent: "#a78bfa",
  },
  {
    icon: <Leaf size={18} />,
    eyebrow: "JARDIM",
    title: "Cultive sua energia",
    body: "A cada foco, uma nova energia brota no seu jardim. Quanto mais longo o foco, mais valiosa a planta.",
    img: "/Onboard/jardim.png",
    href: "/jardim",
    accent: "#4ade80",
  },
  {
    icon: <Trophy size={18} />,
    eyebrow: "LIGA E LOJA",
    title: "Suba e recompense-se",
    body: "Ganhe XP para escalar a liga e troque moedas por auras, escudos e decorações na loja.",
    img: "/Onboard/league.png",
    href: "/liga",
    accent: "#ffd76b",
  },
  {
    icon: <Bell size={18} />,
    eyebrow: "LEMBRETES",
    title: "Não quebre o ritmo",
    body: "Ative as notificações para receber lembretes de focus, check-in e hora de dormir.",
    img: "/Onboard/notifications.png",
    actions: true,
    accent: "#fb7185",
  },
];

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** One-shot radial sparkle burst for the final step. */
function TourBurst({ accent }: { accent: string }) {
  const pieces = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2 + (i % 3) * 0.2;
    const dist = 46 + (i % 4) * 16;
    return {
      id: i,
      bx: `${Math.cos(angle) * dist}px`,
      by: `${Math.sin(angle) * dist}px`,
      size: 3 + (i % 3),
      color: i % 4 === 0 ? "#ffffff" : accent,
      delay: (i % 4) * 0.03,
    };
  });
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="tour-burst-particle"
          style={
            {
              width: p.size,
              height: p.size,
              background: p.color,
              boxShadow: `0 0 8px ${p.color}`,
              animationDelay: `${p.delay}s`,
              ["--bx" as string]: p.bx,
              ["--by" as string]: p.by,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function OnboardingTour() {
  const { user, loading } = useAuth();
  const { season } = useSeason();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [dismissing, setDismissing] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const checkedRef = useRef(false);

  // `?tour` force-opens the tour for visual QA/recordings (no auth needed).
  const forceTour =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("tour");

  // Load settings once (source of truth) and show the tour for first-run users.
  useEffect(() => {
    if (forceTour) {
      const t = window.setTimeout(() => setOpen(true), 0);
      return () => window.clearTimeout(t);
    }
    if (loading || !user || checkedRef.current) return;
    checkedRef.current = true;
    let active = true;
    // Once the user has finished OR skipped the tour, never show it again —
    // even across pages and reloads. The localStorage flag short-circuits the
    // settings fetch (and its flash) on the very same browser; the server flag
    // keeps the choice persistent across devices/sessions.
    let onboardedLocally = false;
    try {
      onboardedLocally = localStorage.getItem("energyos:onboarded") === "1";
    } catch { /* ignore */ }
    if (onboardedLocally) return;
    void api
      .getSettings()
      .then((s) => {
        if (!active) return;
        setOpen(!s.onboardingCompleted);
      })
      .catch(() => { /* silent — never block the app if settings fail */ });
    return () => { active = false; };
  }, [user, loading, forceTour]);

  const persistOnboarded = useCallback(async () => {
    try {
      await api.saveSettings({ onboardingCompleted: true });
    } catch { /* non-fatal */ }
    try {
      localStorage.setItem("energyos:onboarded", "1");
    } catch { /* ignore */ }
  }, []);

  const finish = useCallback(async () => {
    setDismissing(true);
    await persistOnboarded();
    setOpen(false);
  }, [persistOnboarded]);

  const skip = useCallback(async () => {
    setDismissing(true);
    await persistOnboarded();
    setOpen(false);
  }, [persistOnboarded]);

  const goNext = useCallback(() => {
    setDir(1);
    setIndex((i) => Math.min(STEPS.length - 1, i + 1));
  }, []);
  const goPrev = useCallback(() => {
    setDir(-1);
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // Keyboard: ←/→ navigate, Esc closes (same as "Pular tour").
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") skip();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, goNext, goPrev, skip]);

  // Pause ambient CSS animations while the tab is hidden.
  useEffect(() => {
    if (!open) return;
    const onVis = () =>
      document.documentElement.classList.toggle("tour-paused", document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      document.documentElement.classList.remove("tour-paused");
    };
  }, [open]);

  if (!open || dismissing) return null;

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  async function enableNotifications() {
    const result = await requestNotificationPermission();
    setPermission(result);
  }

  const slideVariants = {
    enter: (d: number) => ({
      opacity: 0,
      x: d * 56,
      filter: "blur(6px)",
    }),
    center: { opacity: 1, x: 0, filter: "blur(0px)" },
    exit: (d: number) => ({
      opacity: 0,
      x: d * -56,
      filter: "blur(6px)",
    }),
  };

  // Safety: even if finish() races into a stale render, tapping the backdrop
  // or closing never leaves a user trapped.
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050914]/70 p-4 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={skip}
      >
        {/* faint drifting aurora blob behind the modal */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-3xl"
          style={{
            background: `radial-gradient(circle, ${step.accent}30, transparent 65%)`,
            animation: reduced ? "none" : "tour-aurora 12s ease-in-out infinite alternate",
          }}
        />
        <GlassCard
          static={!!reduced}
          className="relative w-full max-w-md p-6 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* celebration burst on the final step — gold during NY season */}
          {isLast && season?.id === "newyear" && <TourBurst accent="#ffd76b" />}
          {isLast && season?.id !== "newyear" && <TourBurst accent={step.accent} />}

          <button
            type="button"
            aria-label="Fechar"
            onClick={skip}
            className="tour-close absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tour-accent,var(--accent))]"
          >
            <X size={18} />
          </button>

          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={index}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: EASE_OUT }}
              className="relative"
            >
              {/* hero stage — extra 3D flip on step change */}
              <motion.div
                initial={reduced ? false : { rotateY: dir * 55, scale: 0.82, opacity: 0 }}
                animate={{ rotateY: 0, scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 240, damping: 22, delay: 0.05 }}
                style={{ transformStyle: "preserve-3d" }}
              >
                <TourHeroStage
                  src={step.img}
                  icon={step.icon}
                  accent={step.accent}
                  static={!!reduced}
                />
              </motion.div>

              <motion.p
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.3, ease: EASE_OUT }}
                className="eyebrow mb-2 flex items-center justify-center gap-2"
                style={{ color: step.accent }}
              >
                {step.icon}
                {step.eyebrow}
              </motion.p>

              <motion.h2
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.19, duration: 0.3, ease: EASE_OUT }}
                className="font-display text-2xl tracking-[-0.03em] text-white"
              >
                {step.title}
              </motion.h2>

              <motion.p
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.26, duration: 0.3, ease: EASE_OUT }}
                className="mt-2 text-sm leading-relaxed text-white/60"
              >
                {step.body}
              </motion.p>

              {"actions" in step && step.actions && (
                <motion.div
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.33, duration: 0.3 }}
                  className="mt-4 flex flex-col gap-2"
                >
                  {permission === "granted" ? (
                    <p className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300">
                      Notificações ativadas — lembraremos você.
                    </p>
                  ) : permission === "denied" ? (
                    <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-300">
                      Bloqueado no navegador. Você pode liberar nas Configurações.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={enableNotifications}
                      className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tour-accent)]"
                    >
                      Ativar notificações
                    </button>
                  )}
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>

          <div
            className="mt-6 flex items-center justify-between"
            style={{ "--tour-accent": step.accent } as React.CSSProperties}
          >
            <button
              type="button"
              onClick={goPrev}
              disabled={index === 0}
              className="tour-btn-ghost flex items-center gap-1 rounded-full px-3 py-2 text-sm text-white/50 transition enabled:hover:text-white disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tour-accent)]"
            >
              <ChevronLeft size={16} /> Anterior
            </button>

            <div className="flex items-center gap-1.5" aria-label={`Passo ${index + 1} de ${STEPS.length}`}>
              {STEPS.map((s, i) => (
                <motion.span
                  key={i}
                  layout
                  className={`tour-dot ${i === index ? "tour-dot-active" : ""}`}
                  style={i === index ? { width: 20 } : { width: 6 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  aria-hidden
                />
              ))}
            </div>

            {isLast ? (
              <motion.button
                type="button"
                onClick={finish}
                whileHover={reduced ? undefined : { y: -2 }}
                whileTap={{ scale: 0.96 }}
                className="tour-btn-primary tour-btn-final flex items-center gap-1 rounded-full px-5 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tour-accent)]"
              >
                Começar <ChevronRight size={16} />
              </motion.button>
            ) : (
              <motion.button
                type="button"
                onClick={goNext}
                whileHover={reduced ? undefined : { y: -2 }}
                whileTap={{ scale: 0.96 }}
                className="tour-btn-primary group flex items-center gap-1 rounded-full px-5 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tour-accent)]"
              >
                Próximo{" "}
                <span className="transition-transform duration-200 group-hover:translate-x-1">
                  <ChevronRight size={16} />
                </span>
              </motion.button>
            )}
          </div>

          <button
            type="button"
            onClick={skip}
            className="tour-btn-ghost mt-2 text-xs text-white/35 transition hover:text-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tour-accent)]"
          >
            Pular tour
          </button>
        </GlassCard>
      </motion.div>
    </AnimatePresence>
  );
}
