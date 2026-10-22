"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform, type Variants } from "framer-motion";
import { ArrowRight, Sparkles, Zap } from "lucide-react";
import { ACCENT, RECAP_PALETTE } from "@/components/dashboard/recap-theme";

const MONTH_FILES: Record<number, string> = {
  0: "janeiro", 1: "fevereiro", 2: "marco", 3: "abril", 4: "maio", 5: "junho",
  6: "julho", 7: "agosto", 8: "setembro", 9: "outubro", 11: "dezembro",
};
const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTH_ACCENTS = [ACCENT.focus, ACCENT.focus, ACCENT.xp, ACCENT.garden, ACCENT.streak, ACCENT.streak, ACCENT.xp, ACCENT.focus, ACCENT.xp, ACCENT.focus, ACCENT.xp, ACCENT.garden];
const SPARKLES = [
  { x: "13%", y: "29%", delay: 0.2, size: 10 }, { x: "84%", y: "23%", delay: 1.1, size: 8 },
  { x: "10%", y: "64%", delay: 1.7, size: 7 }, { x: "89%", y: "61%", delay: 0.7, size: 11 },
  { x: "75%", y: "40%", delay: 2.1, size: 6 }, { x: "23%", y: "48%", delay: 1.4, size: 6 },
];

function getMonthIcon(iso: string): { src: string | null; alt: string; accent: string } {
  const match = /^(\d{4})-(\d{2})/.exec(iso);
  const monthIndex = match ? Number(match[2]) - 1 : -1;
  const file = MONTH_FILES[monthIndex];
  return {
    src: file ? `/recaps/months/portuguese/${file}.png` : null,
    alt: monthIndex >= 0 && monthIndex < 12 ? `Ícone de ${MONTH_NAMES[monthIndex]}` : "Ícone do energyOS",
    accent: MONTH_ACCENTS[monthIndex] ?? ACCENT.focus,
  };
}

const groupVariants: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.48, staggerChildren: 0.14 } },
};
const revealVariants: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(12px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: "easeOut" } },
};
const heroVariants: Variants = {
  hidden: { opacity: 0, rotateX: -25, rotateY: -25, z: -80, scale: 0.6, filter: "blur(10px)" },
  visible: { opacity: 1, rotateX: 0, rotateY: 0, z: 0, scale: 1, filter: "blur(0px)", transition: { type: "spring", stiffness: 155, damping: 19, mass: 0.8, delay: 0.18 } },
  exit: { opacity: 0, scale: 0.72, rotateX: 16, rotateY: -18, z: -70, filter: "blur(12px)", transition: { duration: 0.24, ease: "easeIn" } },
};

interface RecapIntroSlideProps {
  recapMonth: string;
  monthLabel: string;
  userName: string;
  userPhotoUrl?: string;
  onStart: () => void;
}

export function RecapIntroSlide({ recapMonth, monthLabel, userName, userPhotoUrl, onStart }: RecapIntroSlideProps) {
  const reduced = useReducedMotion();
  const [iconFailed, setIconFailed] = useState(false);
  const { src, alt, accent } = getMonthIcon(recapMonth);
  const tiltXRaw = useMotionValue(0);
  const tiltYRaw = useMotionValue(0);
  const tiltX = useSpring(tiltXRaw, { stiffness: 175, damping: 22, mass: 0.5 });
  const tiltY = useSpring(tiltYRaw, { stiffness: 175, damping: 22, mass: 0.5 });
  const glowX = useTransform(tiltY, (value) => value * -0.32);
  const glowY = useTransform(tiltX, (value) => value * 0.32);
  const iconZ = useTransform(tiltY, [-12, 12], [8, 36]);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    tiltYRaw.set(((event.clientX - rect.left) / rect.width - 0.5) * 24);
    tiltXRaw.set(-((event.clientY - rect.top) / rect.height - 0.5) * 24);
  }, [reduced, tiltXRaw, tiltYRaw]);
  const onPointerLeave = useCallback(() => { tiltXRaw.set(0); tiltYRaw.set(0); }, [tiltXRaw, tiltYRaw]);

  return (
    <div className="absolute inset-0 isolate flex flex-col items-center justify-center overflow-hidden px-5 pb-5 pt-12 text-center sm:px-7 sm:pt-14">
      {/* Atmospheric background and vignette */}
      <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0.2 : 0.8 }} style={{ background: `radial-gradient(ellipse at 50% 40%, ${accent}20 0%, rgba(11,22,39,.16) 38%, transparent 70%), radial-gradient(ellipse at 50% 48%, #07111f 15%, #050b16 100%)` }} />
      <motion.div aria-hidden="true" className="pointer-events-none absolute -top-[8%] left-[-20%] h-64 w-64 rounded-full blur-3xl" style={{ background: `${accent}1b` }} animate={reduced ? undefined : { x: [0, 22, 0], y: [0, 14, 0], opacity: [0.55, 0.85, 0.55] }} transition={reduced ? undefined : { duration: 13, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div aria-hidden="true" className="pointer-events-none absolute right-[-22%] bottom-[8%] h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" animate={reduced ? undefined : { x: [0, -20, 0], y: [0, -16, 0] }} transition={reduced ? undefined : { duration: 16, repeat: Infinity, ease: "easeInOut" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 42%, rgba(2,8,18,.44) 100%)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[.16]" style={{ backgroundImage: "radial-gradient(rgba(231,244,255,.42) .55px, transparent .8px)", backgroundSize: "22px 22px", maskImage: "linear-gradient(transparent, black 22%, black 82%, transparent)" }} />

      <div className="relative z-10 flex h-full w-full max-w-sm flex-col items-center justify-between" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
        <motion.div variants={revealVariants} initial={reduced ? "visible" : "hidden"} animate="visible" className="flex shrink-0 items-center justify-center gap-2.5 pt-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--text-faint)] sm:tracking-[0.34em]">energyOS</span>
          <span aria-hidden="true" className="h-px w-8 bg-white/20" />
          <span className="text-[10px] font-bold uppercase tracking-[0.24em] sm:tracking-[0.34em]" style={{ color: accent }}>Recap de</span>
        </motion.div>

        <div className="relative flex min-h-0 w-full flex-1 flex-col items-center justify-center py-1" style={{ perspective: 800, transformStyle: "preserve-3d" }}>
          <motion.div aria-hidden="true" className="pointer-events-none absolute aspect-square w-[76%] max-w-[310px] rounded-full" style={{ background: `radial-gradient(circle, ${accent}3a 0%, ${accent}1a 38%, transparent 70%)`, filter: "blur(38px)", x: reduced ? 0 : glowX, y: reduced ? 0 : glowY }} animate={reduced ? undefined : { opacity: [0.58, 0.88, 0.58], scale: [0.94, 1.06, 0.94] }} transition={reduced ? undefined : { duration: 5.5, repeat: Infinity, ease: "easeInOut" }} />
          <motion.span aria-hidden="true" className="pointer-events-none absolute aspect-square w-[63%] max-w-[260px] rounded-full" style={{ border: `1px solid ${accent}28`, boxShadow: `0 0 55px -18px ${accent}55, inset 0 0 36px -20px ${accent}45`, x: reduced ? 0 : glowX, y: reduced ? 0 : glowY }} animate={reduced ? undefined : { opacity: [0.34, 0.62, 0.34], scale: [0.98, 1.03, 0.98] }} transition={reduced ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }} />
          <motion.div aria-hidden="true" className="pointer-events-none absolute bottom-[8%] h-7 w-[56%] max-w-[220px] rounded-[50%]" style={{ background: `radial-gradient(ellipse, ${accent}5a, transparent 72%)`, filter: "blur(13px)", x: reduced ? 0 : glowX }} />

          <AnimatePresence mode="wait" propagate>
            <motion.div key="month-hero" variants={heroVariants} initial={reduced ? { opacity: 0 } : "hidden"} animate="visible" exit="exit" className="relative z-10 flex h-full max-h-[min(46vh,330px)] w-[min(74vw,290px)] items-center justify-center" style={{ transformStyle: "preserve-3d", rotateX: reduced ? 0 : tiltX, rotateY: reduced ? 0 : tiltY }}>
              {!iconFailed && src ? (
                <motion.div className="h-full w-full" style={{ z: reduced ? 0 : iconZ }}>
                  <Image src={src} alt={alt} width={500} height={500} priority draggable={false} onError={() => setIconFailed(true)} className="h-full w-full object-contain drop-shadow-[0_18px_40px_rgba(92,200,255,.22)]" style={{ filter: `drop-shadow(0 18px 36px ${accent}48)`, mixBlendMode: "screen" }} />
                </motion.div>
              ) : (
                <Zap aria-label={alt} size={132} strokeWidth={1.2} style={{ color: accent, filter: `drop-shadow(0 0 35px ${accent}90)`, transform: "translateZ(30px)" }} />
              )}
            </motion.div>
          </AnimatePresence>

          {SPARKLES.map((sparkle, index) => (
            <motion.span key={index} aria-hidden="true" className="pointer-events-none absolute z-20" style={{ left: sparkle.x, top: sparkle.y, color: `${accent}bb` }} animate={reduced ? undefined : { opacity: [0.15, 0.75, 0.15], scale: [0.75, 1.12, 0.75], y: [0, -4, 0] }} transition={reduced ? undefined : { duration: 2.8 + index * 0.24, delay: sparkle.delay, repeat: Infinity, ease: "easeInOut" }}><Sparkles size={sparkle.size} strokeWidth={1.4} /></motion.span>
          ))}
        </div>

        <motion.div variants={groupVariants} initial={reduced ? "visible" : "hidden"} animate="visible" className="relative z-10 flex w-full shrink-0 flex-col items-center gap-2.5 pb-1">
          <motion.div variants={revealVariants}>
            <motion.h2 className="font-display text-[clamp(2.5rem,11vw,3.65rem)] font-extrabold leading-[.96] tracking-[-0.04em]" style={{ background: "linear-gradient(120deg, #E7F4FF 0%, #5CC8FF 42%, #A98BFF 78%, #FFB067 100%)", backgroundSize: "190% 100%", backgroundPosition: "0% 50%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }} animate={reduced ? undefined : { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }} transition={reduced ? undefined : { duration: 9, repeat: Infinity, ease: "easeInOut" }}>{monthLabel}</motion.h2>
          </motion.div>

          <motion.div variants={revealVariants} className="flex max-w-full items-center gap-2.5 rounded-full border border-white/[.09] px-3 py-1.5" style={{ background: "linear-gradient(155deg, rgba(255,255,255,.065), rgba(255,255,255,.018))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.08), 0 16px 34px -28px rgba(0,0,0,.9)" }}>
            {userPhotoUrl ? <Image src={userPhotoUrl} alt={userName} width={38} height={38} className="h-[38px] w-[38px] shrink-0 rounded-full object-cover ring-1 ring-white/15" unoptimized draggable={false} /> : <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full font-display text-sm font-bold" style={{ background: `linear-gradient(140deg, ${ACCENT.focus}, ${ACCENT.xp})`, color: RECAP_PALETTE.midnight }}>{userName.charAt(0).toUpperCase()}</span>}
            <span className="min-w-0 text-left"><span className="block max-w-[190px] truncate font-display text-sm font-semibold text-[var(--text)]">{userName}</span><span className="block text-[10px] text-[var(--text-muted)]">Seu mês no EnergyOS</span></span>
          </motion.div>

          <motion.div variants={revealVariants} className="w-full pt-0.5">
            <motion.button type="button" onClick={onStart} whileHover={reduced ? undefined : { y: -2, scale: 1.015 }} whileTap={reduced ? undefined : { scale: 0.97 }} className="group mx-auto flex min-h-12 w-full max-w-[280px] cursor-pointer items-center justify-center gap-2.5 rounded-2xl border border-white/[.16] px-5 py-3 text-sm font-bold tracking-[.02em] text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,.14)] transition-colors hover:border-white/25 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white/80" style={{ background: `linear-gradient(140deg, ${accent}32, rgba(255,255,255,.07))`, boxShadow: `inset 0 1px 0 rgba(255,255,255,.12), 0 12px 34px -18px ${accent}bb` }}>
              Começar meu recap
              <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full bg-white/10 transition group-hover:bg-white/20"><ArrowRight size={15} /></span>
            </motion.button>
            <p className="mt-2 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--text-faint)]">7 capítulos <span aria-hidden="true">·</span> avanço automático em 10 s</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
