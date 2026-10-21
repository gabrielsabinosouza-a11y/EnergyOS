"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, Download, Loader2, Share2 } from "lucide-react";
import type { MonthlyRecap } from "@/types";
import { Modal } from "@/components/modal";
import { captureRecapCard } from "@/components/dashboard/monthly-recap-premium";
import { FinalRecapSurface } from "@/components/dashboard/recap-final-surface";
import { formatMonth, type RecapData } from "@/components/dashboard/recap-theme";
import { useRecapSound } from "@/lib/recap-sound";

/**
 * Tela final do recap.
 *
 * A composição é a SUPERFÍCIE EDITORIAL compartilhada com o modal do perfil
 * (`FinalRecapSurface`): herói com a arte 3D do mês, dashboard assimétrico de
 * conquistas e faixa de detalhamento. Este componente existe para o fluxo
 * antigo (`recap-section`), que abre a tela final fora do modal 9:16.
 */

interface FinalPageProps {
  recap: MonthlyRecap;
  userName: string;
  userPhotoUrl?: string;
  onClose: () => void;
}

export function FinalPage({ recap, userName, userPhotoUrl, onClose }: FinalPageProps) {
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const reduced = useReducedMotion();
  const { enabled: soundEnabled, play: playSound } = useRecapSound();

  const monthLabel = useMemo(() => formatMonth(recap.recapMonth), [recap.recapMonth]);

  // O mesmo recorte de dados usado pelo modal do perfil.
  const data: RecapData = useMemo(
    () => ({
      id: recap.id,
      recapMonth: recap.recapMonth,
      totalFocusMinutes: recap.totalFocusMinutes,
      longestStreak: recap.longestStreak,
      leagueTier: recap.leagueTier,
      leaguePromoted: recap.leaguePromoted,
      productivityTag: recap.productivityTag,
      gardenCount: recap.gardenCount,
      totalXp: recap.totalXp,
      coinsGained: recap.coinsGained,
      coinsSpent: recap.coinsSpent,
      missionsCompleted: recap.missionsCompleted,
      goalsCompleted: recap.goalsCompleted,
      achievementsUnlocked: recap.achievementsUnlocked,
      topFocusCategory: recap.topFocusCategory,
      hasBeenShared: recap.hasBeenShared,
      status: recap.status,
      streakStartDate: recap.streakStartDate,
      streakEndDate: recap.streakEndDate,
      streakIsAlive: recap.streakIsAlive,
      leagueAtStart: recap.leagueAtStart,
      xpSources: recap.xpSources,
    }),
    [recap],
  );

  // Brilho de entrada (som do recap).
  useEffect(() => {
    if (soundEnabled) playSound("sparkle");
  }, [soundEnabled, playSound]);

  const fileName = `recap-energyos-${recap.recapMonth.slice(0, 7)}.png`;

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await captureRecapCard(data, userName, userPhotoUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [data, userName, userPhotoUrl, fileName]);

  const handleShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const blob = await captureRecapCard(data, userName, userPhotoUrl);
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Meu recap de ${monthLabel} no energyOS`,
          text: `Meu recap de ${monthLabel} no energyOS`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
    } finally {
      setSharing(false);
    }
  }, [data, userName, userPhotoUrl, sharing, monthLabel, fileName]);

  const header = (
    <div className="flex items-center gap-3">
      <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] sm:block">
        Recap · {monthLabel}
      </span>
    </div>
  );

  const footer = (
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
      <motion.button
        type="button"
        whileHover={reduced ? undefined : { y: -2 }}
        whileTap={reduced ? undefined : { scale: 0.97 }}
        onClick={onClose}
        className="order-last col-span-2 flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[.04] text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-white/[.09] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 sm:order-first sm:col-span-1 sm:w-auto sm:px-4"
      >
        <ChevronLeft size={14} />
        Voltar
      </motion.button>

      <motion.button
        type="button"
        whileHover={reduced ? undefined : { y: -2 }}
        whileTap={reduced ? undefined : { scale: 0.97 }}
        onClick={handleDownload}
        disabled={downloading}
        className="flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:opacity-60"
        style={{
          background: "linear-gradient(135deg, #71d4ff, #5CC8FF)",
          color: "#07111f",
          boxShadow: "0 10px 26px -12px rgba(113,212,255,.85)",
        }}
      >
        {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        Baixar PNG
      </motion.button>

      <motion.button
        type="button"
        whileHover={reduced ? undefined : { y: -2 }}
        whileTap={reduced ? undefined : { scale: 0.97 }}
        onClick={handleShare}
        disabled={sharing}
        className="flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:opacity-60"
        style={{
          background: "rgba(255,255,255,.07)",
          border: "1px solid rgba(113,212,255,.35)",
          color: "#71d4ff",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        {sharing ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
        Compartilhar
      </motion.button>
    </div>
  );

  return (
    <Modal
      onClose={onClose}
      title={header}
      footer={footer}
      panelClassName="lg:max-h-[min(94dvh,940px)] lg:max-w-[1180px] bg-[radial-gradient(1200px_620px_at_12%_-12%,rgba(92,200,255,.14),transparent_60%),radial-gradient(980px_520px_at_88%_-6%,rgba(169,139,255,.13),transparent_62%),radial-gradient(900px_620px_at_60%_112%,rgba(255,176,103,.07),transparent_62%)]"
    >
      <FinalRecapSurface
        recap={data}
        userName={userName}
        userPhotoUrl={userPhotoUrl}
        monthLabel={monthLabel}
      />
    </Modal>
  );
}
