"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ChevronDown, FlaskConical, Loader2, Lock } from "lucide-react";
import { XpIcon } from "@/components/xp-icon";
import { CoinIcon } from "@/components/coin-icon";
import { api } from "@/lib/api-client";
import { XP_BOOST_ITEM, XP_BOOST_COST, XP_BOOST_MAX_HELD } from "@/lib/xp-boost";
import { formatRemaining } from "@/components/xp-boost/xp-boost-indicator";
import { levelFromXP } from "@/lib/xp-levels";

interface XPBadgeProps {
  xp: number;
  coins: number;
  boostExpiresAt: string | null;
  /** Atualiza o saldo de moedas no painel após comprar/usar a poção. */
  onCoinsChange: (coins: number) => void;
  /** Atualiza o estado do boost no painel (null = expirou/inativo). */
  onBoostChange: (expiresAt: string | null) => void;
}

export function XPBadge({
  xp,
  coins,
  boostExpiresAt,
  onCoinsChange,
  onBoostChange,
}: XPBadgeProps) {
  const [open, setOpen] = useState(false);
  const [potionQuantity, setPotionQuantity] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [processing, setProcessing] = useState<"buy" | "use" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const boostRef = useRef<string | null>(boostExpiresAt);
  const menuRef = useRef<HTMLDivElement>(null);

  const levelInfo = levelFromXP(xp);
  const boostActive = remainingSeconds > 0;
  const atMaxHeld = potionQuantity >= XP_BOOST_MAX_HELD;
  const useDisabled = boostActive || potionQuantity <= 0 || processing === "use";
  const buyDisabled = atMaxHeld || coins < XP_BOOST_COST || processing === "buy";

  const loadData = useCallback(async () => {
    try {
      const data = await api.getXpBoost();
      setPotionQuantity(data.quantity ?? 0);
      const expiresAt = data.boost?.expiresAt ?? null;
      onBoostChange(expiresAt);
      boostRef.current = expiresAt;
      if (expiresAt) {
        setRemainingSeconds(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
      } else {
        setRemainingSeconds(0);
      }
    } catch {
      // Mantém os valores anteriores em caso de falha.
    }
  }, [onBoostChange]);

  useEffect(() => {
    if (!open || !boostRef.current) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(boostRef.current!).getTime() - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        setRemainingSeconds(0);
        onBoostChange(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [open, onBoostChange]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setError(null);
      loadData();
    }
  }

  async function handleBuy() {
    setProcessing("buy");
    setError(null);
    try {
      const { balance, quantity } = await api.purchaseXpBoost();
      onCoinsChange(balance);
      setPotionQuantity(quantity);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao comprar a poção.");
    } finally {
      setProcessing(null);
    }
  }

  async function handleUse() {
    setProcessing("use");
    setError(null);
    try {
      const { boost, quantity } = await api.activateXpBoost();
      onBoostChange(boost.expiresAt);
      boostRef.current = boost.expiresAt;
      setRemainingSeconds(Math.max(0, Math.floor((new Date(boost.expiresAt).getTime() - Date.now()) / 1000)));
      setPotionQuantity(quantity);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao usar a poção.");
    } finally {
      setProcessing(null);
    }
  }

  const progress =
    levelInfo.nextThreshold === null
      ? 100
      : Math.min(
          100,
          Math.round(((xp - levelInfo.thresholdStart) / (levelInfo.nextThreshold - levelInfo.thresholdStart)) * 100),
        );

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Abra o menu de XP e níveis"
        className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-3 py-1.5 transition hover:border-[var(--border)] hover:bg-[var(--bg-surface)]"
      >
        <XpIcon size={22} level={levelInfo.level} />
        <span className="font-mono text-xs font-medium text-[#ffb86b]">{xp} XP</span>
        <span className="text-[var(--text-faint)]">·</span>
        <span className="text-xs text-[var(--text-muted)]">Nv. {levelInfo.label}</span>
        <ChevronDown size={12} className={`text-[var(--text-faint)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-xl shadow-black/40 backdrop-blur-xl"
          >
            {/* Cabecalho: XP + Nível + progresso */}
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display flex items-center gap-1.5 text-base font-semibold text-[#ffb86b]">
                  <XpIcon size={20} level={levelInfo.level} /> {xp} XP
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Nível {levelInfo.label}{" "}
                  {levelInfo.nextThreshold !== null
                    ? `· faltam ${(levelInfo.nextThreshold - xp).toLocaleString("pt-BR")} XP`
                    : "· nível máximo"}
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#ffb86b]/30 bg-[#ffb86b]/10 text-sm font-bold text-[#ffb86b]">
                Nv {levelInfo.label}
              </div>
            </div>

            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface-hover)]">
              <motion.div
                className="h-full rounded-full bg-[#ffb86b]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>

            {/* Boost ativo */}
            {boostActive ? (
              <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-[#b69cff]/40 bg-[#b69cff]/10 px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#b69cff]">
                  <XpIcon size={12} variant="double" /> 2x XP ativo
                </span>
                <span className="font-mono text-[10px] text-[#b69cff]/80">
                  {formatRemaining(remainingSeconds)}
                </span>
              </div>
            ) : (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-[var(--text-faint)]">
                <XpIcon size={12} variant="double" /> Sem boost ativo · ative ou compre uma poção
              </div>
            )}

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-3 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300"
              >
                <AlertCircle size={12} /> {error}
              </motion.p>
            )}

            {/* Estoque */}
            <div className="mb-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <FlaskConical size={13} className="text-[#b69cff]" />
              Você possui: <strong className="text-[#b69cff]">{potionQuantity} / {XP_BOOST_MAX_HELD}</strong>
              <span className="text-[var(--text-faint)]">· {XP_BOOST_ITEM.price} moedas cada</span>
            </div>

            {/* Acoes */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleUse}
                disabled={useDisabled}
                title={boostActive ? "Poção já ativa" : undefined}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#b69cff]/20 px-3 py-2 text-xs font-semibold text-[#b69cff] transition hover:bg-[#b69cff]/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {processing === "use" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : boostActive ? (
                  "Poção ativa"
                ) : (
                  <><XpIcon size={13} variant="double" /> Usar poção</>
                )}
              </button>

              {atMaxHeld ? (
                <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-[var(--text-faint)]">
                  <Lock size={12} /> Cheio
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleBuy}
                  disabled={buyDisabled}
                  title={coins < XP_BOOST_COST ? "Moedas insuficientes" : undefined}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--green-bg)] px-3 py-2 text-xs font-semibold text-[var(--green)] transition hover:bg-[var(--green)]/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {processing === "buy" ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <><CoinIcon size={13} /> Comprar · {XP_BOOST_COST}</>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}