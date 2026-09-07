"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Bell, Sun, Target, Leaf, Trophy, Zap } from "lucide-react";
import Image from "next/image";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { requestNotificationPermission } from "@/lib/reminders";

interface Step {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  img?: string;
  href?: string;
  actions?: boolean;
}

const STEPS: Step[] = [
  {
    icon: <Sun size={18} />,
    eyebrow: "BOAS-VINDAS",
    title: "energyOS",
    body: "Seu painel de energia, foco e consistência. Aqui, cada hábito vira progresso — e cada foco planta algo novo.",
    img: "/icons_8bits/logo.png",
  },
  {
    icon: <Zap size={18} />,
    eyebrow: "CHECK-IN DIÁRIO",
    title: "Comece pelo seu ritmo",
    body: "Registre sono, estudo, treino e energia todos os dias. O check-in alimenta seus indicadores e mantém a consistência.",
    href: "/dashboard",
  },
  {
    icon: <Target size={18} />,
    eyebrow: "FOCO",
    title: "Dê o primeiro passo: foque",
    body: "Use o timer ou entre em uma sala de foco. Cada sessão concluída rende XP, moedas e conta para o seu streak — do painel ou da sala.",
    href: "/salas-de-foco",
  },
  {
    icon: <Leaf size={18} />,
    eyebrow: "JARDIM",
    title: "Cultive sua energia",
    body: "A cada foco, uma nova energia brota no seu jardim. Quanto mais longo o foco, mais valiosa a planta.",
    href: "/jardim",
  },
  {
    icon: <Trophy size={18} />,
    eyebrow: "LIGA E LOJA",
    title: "Suba e recompense-se",
    body: "Ganhe XP para escalar a liga e troque moedas por auras, escudos e decorações na loja.",
    href: "/liga",
  },
  {
    icon: <Bell size={18} />,
    eyebrow: "LEMBRETES",
    title: "Não quebre o ritmo",
    body: "Ative as notificações para receber lembretes de focus, check-in e hora de dormir.",
    actions: true,
  },
];

export function OnboardingTour() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const checkedRef = useRef(false);

  // Load settings once (source of truth) and show the tour for first-run users.
  useEffect(() => {
    if (loading || !user || checkedRef.current) return;
    checkedRef.current = true;
    let active = true;
    void api
      .getSettings()
      .then((s) => {
        if (!active) return;
        // Onboarding persists server-side; also suppress a flash on re-login
        // until the fetch lands, so the tour only pops for real first runs.
        setOpen(!s.onboardingCompleted);
      })
      .catch(() => { /* silent — never block the app if settings fail */ });
    return () => { active = false; };
  }, [user, loading]);

  const finish = useCallback(async () => {
    setDismissing(true);
    try {
      await api.saveSettings({ onboardingCompleted: true });
    } catch { /* non-fatal */ }
    try {
      localStorage.setItem("energyos:onboarded", "1");
    } catch { /* ignore */ }
    setOpen(false);
  }, []);

  const skip = useCallback(() => {
    setOpen(false);
  }, []);

  if (!open || dismissing) return null;

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  async function enableNotifications() {
    const result = await requestNotificationPermission();
    setPermission(result);
  }

  // Safety: even if finish() races into a stale render, tapping the backdrop
  // or closing never leaves a user trapped.
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={skip}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="glass-card relative w-full max-w-md overflow-hidden rounded-2xl border p-6 text-center shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label="Fechar"
            onClick={skip}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-faint)] transition hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text)]"
          >
            <X size={18} />
          </button>

          <p className="eyebrow mb-3 flex items-center justify-center gap-2 text-[var(--accent)]">
            {step.icon}
            {step.eyebrow}
          </p>

          {"actions" in step && step.actions ? (
            <Bell size={44} className="mx-auto mb-3 text-[#ffb86b]" />
          ) : step.img ? (
            <Image
              src={step.img}
              alt=""
              width={64}
              height={64}
              className="mx-auto mb-3 object-contain"
            />
          ) : (
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] text-[var(--accent)]">
              {step.icon ?? <Sun size={28} />}
            </div>
          )}

          <h2 className="font-display text-2xl tracking-[-0.03em]">{step.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{step.body}</p>

          {"actions" in step && step.actions && (
            <div className="mt-4 flex flex-col gap-2">
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
                  className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-[var(--bg-primary)] transition hover:opacity-90"
                >
                  Ativar notificações
                </button>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="flex items-center gap-1 rounded-full px-3 py-2 text-sm text-[var(--text-muted)] transition enabled:hover:text-[var(--text)] disabled:opacity-30"
            >
              <ChevronLeft size={16} /> Anterior
            </button>

            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-[var(--accent)]" : "w-1.5 bg-[var(--border-subtle)]"}`}
                />
              ))}
            </div>

            {isLast ? (
              <button
                type="button"
                onClick={finish}
                className="flex items-center gap-1 rounded-full bg-[#ffb86b] px-5 py-2 text-sm font-bold text-black transition hover:opacity-90"
              >
                Começar <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(STEPS.length - 1, i + 1))}
                className="flex items-center gap-1 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-bold text-[var(--bg-primary)] transition hover:opacity-90"
              >
                Próximo <ChevronRight size={16} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={skip}
            className="mt-2 text-xs text-[var(--text-faint)] transition hover:text-[var(--text-muted)]"
          >
            Pular tour
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}