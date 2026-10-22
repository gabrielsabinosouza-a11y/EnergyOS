"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform, type Variants } from "framer-motion";
import { Zap } from "lucide-react";

const MONTH_FILES: Record<number, string> = {
  0: "janeiro", 1: "fevereiro", 2: "marco", 3: "abril", 4: "maio", 5: "junho",
  6: "julho", 7: "agosto", 8: "setembro", 9: "outubro", 11: "dezembro",
};
const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function getMonthIcon(iso: string): { src: string | null; alt: string } {
  const match = /^(\d{4})-(\d{2})/.exec(iso);
  const monthIndex = match ? Number(match[2]) - 1 : -1;
  const file = MONTH_FILES[monthIndex];
  return {
    src: file ? `/recaps/months/portuguese/${file}.png` : null,
    alt: monthIndex >= 0 && monthIndex < 12 ? `Ícone de ${MONTH_NAMES[monthIndex]}` : "Ícone do energyOS",
  };
}

const contentVariants: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.12, staggerChildren: 0.13 } },
};
const textVariants: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(12px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: "easeOut" } },
};
const iconVariants: Variants = {
  hidden: { opacity: 0, rotateX: -25, rotateY: -25, z: -70, scale: 0.7, filter: "blur(8px)" },
  visible: { opacity: 1, rotateX: 0, rotateY: 0, z: 0, scale: 1, filter: "blur(0px)", transition: { type: "spring", stiffness: 180, damping: 18, mass: 0.8 } },
  exit: { opacity: 0, scale: 0.76, rotateX: 16, rotateY: -18, z: -50, filter: "blur(12px)", transition: { duration: 0.24, ease: "easeIn" } },
};

interface RecapIntroSlideProps {
  recapMonth: string;
  monthLabel: string;
  userName: string;
  userPhotoUrl?: string;
  accent: string;
  glow: string;
}

export function RecapIntroSlide({ recapMonth, monthLabel, userName, userPhotoUrl, accent, glow }: RecapIntroSlideProps) {
  const reduced = useReducedMotion();
  const [iconFailed, setIconFailed] = useState(false);
  const tiltXRaw = useMotionValue(0);
  const tiltYRaw = useMotionValue(0);
  const tiltX = useSpring(tiltXRaw, { stiffness: 180, damping: 22, mass: 0.5 });
  const tiltY = useSpring(tiltYRaw, { stiffness: 180, damping: 22, mass: 0.5 });
  const cardX = useTransform(tiltY, (value) => value * 0.38);
  const cardY = useTransform(tiltX, (value) => value * -0.38);
  const iconZ = useTransform(tiltY, [-15, 15], [10, 30]);
  const { src, alt } = getMonthIcon(recapMonth);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    tiltYRaw.set(((event.clientX - rect.left) / rect.width - 0.5) * 30);
    tiltXRaw.set(-((event.clientY - rect.top) / rect.height - 0.5) * 30);
  }, [reduced, tiltXRaw, tiltYRaw]);
  const onPointerLeave = useCallback(() => { tiltXRaw.set(0); tiltYRaw.set(0); }, [tiltXRaw, tiltYRaw]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-5 pb-6 pt-16 text-center">
      <motion.div aria-hidden="true" className="pointer-events-none absolute -top-8 left-1/2 h-44 w-52 -translate-x-1/2 rounded-full blur-3xl" style={{ background: `${accent}38` }} animate={reduced ? undefined : { x: [-16, 18, -16], y: [0, 12, 0], scale: [0.95, 1.08, 0.95] }} transition={reduced ? undefined : { duration: 12, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div aria-hidden="true" className="pointer-events-none absolute right-[-15%] bottom-1/4 h-40 w-44 rounded-full bg-violet-400/10 blur-3xl" animate={reduced ? undefined : { x: [12, -14, 12], y: [0, -10, 0] }} transition={reduced ? undefined : { duration: 15, repeat: Infinity, ease: "easeInOut" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 34%, rgba(2,8,18,.32) 100%)" }} />

      <div className="relative z-10 flex flex-col items-center gap-3" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
        <AnimatePresence mode="wait" propagate>
          <motion.div key="month-icon" variants={iconVariants} initial="hidden" animate="visible" exit="exit" className="relative mb-1 grid h-28 w-28 place-items-center" style={{ perspective: 800, transformStyle: "preserve-3d", rotateX: reduced ? 0 : tiltX, rotateY: reduced ? 0 : tiltY }}>
            <motion.div aria-hidden="true" className="absolute inset-0 rounded-[30px]" style={{ translateX: cardX, translateY: cardY, border: `1px solid ${accent}75`, backgroundImage: `linear-gradient(145deg, rgba(255,255,255,.11), rgba(255,255,255,.025) 68%), linear-gradient(145deg, ${accent}88, rgba(255,255,255,.12), #a98bff66)`, backgroundOrigin: "border-box", backgroundClip: "padding-box, border-box", backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", boxShadow: `inset 0 1px 0 rgba(255,255,255,.24), 0 14px 44px -18px ${glow}` }} />
            <motion.div aria-hidden="true" className="pointer-events-none absolute -inset-1 rounded-[32px]" animate={reduced ? undefined : { opacity: [0.28, 0.62, 0.28], boxShadow: [`0 0 12px ${accent}55`, `0 0 28px ${accent}99`, `0 0 12px ${accent}55`] }} transition={reduced ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }} style={{ border: `1px solid ${accent}66` }} />
            {!reduced && <motion.div aria-hidden="true" className="pointer-events-none absolute -inset-[2px] rounded-[32px] opacity-80" animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} style={{ background: `conic-gradient(from 0deg, transparent 0 76%, ${accent} 83%, transparent 91%)`, mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)", maskComposite: "exclude", padding: 1 }} />}
            <motion.div className="relative grid h-24 w-24 place-items-center" style={{ z: reduced ? 0 : iconZ, filter: `drop-shadow(0 10px 16px ${accent}55)` }} animate={reduced ? undefined : { y: [0, -6, 0], rotate: [0, 1.2, 0, -1.2, 0] }} transition={reduced ? undefined : { duration: 5, repeat: Infinity, ease: "easeInOut" }}>
              {src && !iconFailed ? <Image src={src} alt={alt} width={96} height={96} priority className="h-24 w-24 object-contain" draggable={false} onError={() => setIconFailed(true)} /> : <Zap size={48} color="#07111f" strokeWidth={2.5} />}
            </motion.div>
            <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]" whileHover={reduced ? undefined : { opacity: 1 }} initial={{ opacity: 0 }}>
              <motion.span className="absolute -inset-y-8 w-8 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm" animate={reduced ? undefined : { x: [-60, 140] }} transition={reduced ? undefined : { duration: 2.8, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }} />
            </motion.div>
          </motion.div>
        </AnimatePresence>

        <motion.div variants={contentVariants} initial={reduced ? "visible" : "hidden"} animate="visible" className="flex flex-col items-center gap-3">
          <motion.p variants={textVariants} className="text-xs font-medium tracking-[0.28em] uppercase" style={{ color: "rgba(231,244,255,.4)" }}>Recap de</motion.p>
          <motion.h2 variants={textVariants} className="font-display max-w-full text-[clamp(1.4rem,6vw,2.25rem)] font-extrabold leading-none break-words" style={{ backgroundImage: "linear-gradient(110deg, #71d4ff 0%, #b69cff 35%, #ffb86b 52%, #b69cff 68%, #71d4ff 100%)", backgroundSize: "220% 100%", backgroundPosition: "0% 50%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }} animate={reduced ? undefined : { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }} transition={reduced ? undefined : { duration: 8, repeat: Infinity, ease: "easeInOut" }}>{monthLabel}</motion.h2>
          <motion.div variants={textVariants} className="mt-1 flex items-center gap-2.5">
            {userPhotoUrl ? <Image src={userPhotoUrl} alt={userName} width={36} height={36} className="h-9 w-9 rounded-full object-cover ring-2 ring-[rgba(255,255,255,.18)]" unoptimized draggable={false} /> : <div className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-[#07111f]" style={{ background: `linear-gradient(135deg, ${accent}, #b69cff)` }}>{userName.charAt(0).toUpperCase()}</div>}
            <span className="text-base font-semibold" style={{ color: "rgba(231,244,255,.82)" }}>{userName}</span>
          </motion.div>
          <motion.p variants={textVariants} className="mt-3 text-[10px] tracking-[0.2em] uppercase" style={{ color: "rgba(231,244,255,.3)" }} animate={reduced ? undefined : { opacity: [0.3, 0.7, 0.3] }} transition={reduced ? undefined : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }}>Toque para começar</motion.p>
        </motion.div>
      </div>
    </div>
  );
}
