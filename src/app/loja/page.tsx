"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  AnimatePresence,
} from "framer-motion";
import {
  Image as ImageIcon,
  Frame,
  Shield,
  Sparkles,
  X,
  Loader2,
  Upload,
  Check,
  Lock,
  AlertCircle,
  FlaskConical,
  Zap,
} from "lucide-react";
import { CoinIcon } from "@/components/coin-icon";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/navigation";
import { Modal } from "@/components/modal";
import { useAuthRedirect } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Image from "next/image";
import {
  AURA_DEFS,
  AURA_RARITY_COLORS,
  AURA_RARITY_LABELS,
  ENERGY_CONFIGS,
  ENERGY_TYPES,
  type EnergyType,
} from "@/lib/energy-assets";
import type { StoreItem, DecorationRarity, ActiveXPBoost, StreakShieldDesign } from "@/types";
import { FRAME_ASSETS } from "@/components/avatar";
import { XP_BOOST_ITEM, XP_BOOST_MAX_HELD, XP_BOOST_DURATION_MS, isXpBoostActive } from "@/lib/xp-boost";
import { XpBoostCelebration } from "@/components/xp-boost/xp-boost-celebration";
import { formatRemaining } from "@/components/xp-boost/xp-boost-indicator";

/* ------------------------------------------------------------------ */
/*  Rarity colour system (unified)                                     */
/* ------------------------------------------------------------------ */

type StoreRarity = DecorationRarity | "uncommon";

const RARITY_COLORS: Record<
  StoreRarity,
  { border: string; bg: string; label: string; glow: string }
> = {
  common: {
    border: "#71d4ff",
    bg: "rgba(113,212,255,0.08)",
    label: "Comum",
    glow: "rgba(113,212,255,0.32)",
  },
  uncommon: {
    border: "#4ade80",
    bg: "rgba(74,222,128,0.08)",
    label: "Incomum",
    glow: "rgba(74,222,128,0.32)",
  },
  rare: {
    border: "#b69cff",
    bg: "rgba(182,156,255,0.08)",
    label: "Rara",
    glow: "rgba(182,156,255,0.32)",
  },
  epic: {
    border: "#ffb86b",
    bg: "rgba(255,184,107,0.08)",
    label: "Épica",
    glow: "rgba(255,184,107,0.34)",
  },
  legendary: {
    border: "#ffd76b",
    bg: "rgba(255,215,107,0.08)",
    label: "Lendária",
    glow: "rgba(255,215,107,0.4)",
  },
};

const rarityOf = (rarity: string): StoreRarity =>
  (Object.keys(RARITY_COLORS) as StoreRarity[]).includes(rarity as StoreRarity)
    ? (rarity as StoreRarity)
    : "common";

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055 } },
  container: {
    hidden: {},
    visible: { transition: { staggerChildren: 0.055 } },
  },
  item: {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

/* ------------------------------------------------------------------ */
/*  3D tilt-on-hover card (disabled on touch / reduced motion)         */
/* ------------------------------------------------------------------ */

function TiltCard({
  children,
  reduced,
  className = "",
}: {
  children: React.ReactNode;
  reduced: boolean;
  className?: string;
}) {
  const [hoverCapable, setHoverCapable] = useState(false);

  useEffect(() => {
    setHoverCapable(
      typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches,
    );
  }, []);

  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 260, damping: 22 });
  const sry = useSpring(ry, { stiffness: 260, damping: 22 });

  const rotateX = useTransform(srx, [-0.5, 0.5], [5, -5]);
  const rotateY = useTransform(sry, [-0.5, 0.5], [-5, 5]);

  const enabled = !reduced && hoverCapable;

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!enabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    rx.set((e.clientY - rect.top) / rect.height - 0.5);
    ry.set((e.clientX - rect.left) / rect.width - 0.5);
  };

  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      whileTap={enabled ? undefined : { scale: 0.97 }}
      style={{ transformStyle: "preserve-3d", rotateX: enabled ? rotateX : 0, rotateY: enabled ? rotateY : 0, perspective: 900 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Decoration Ring Preview (fallback)                                 */
/* ------------------------------------------------------------------ */

function DecorationRing({
  rarity,
  size = 80,
}: {
  rarity: StoreRarity;
  size?: number;
}) {
  const c = RARITY_COLORS[rarity];
  const r = size / 2 - 4;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.border} strokeWidth={2} opacity={0.7} />
      {rarity === "rare" && (
        <circle cx={size / 2} cy={size / 2} r={r - 5} fill="none" stroke={c.border} strokeWidth={1} opacity={0.35} />
      )}
      {rarity === "epic" && (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.border} strokeWidth={4} opacity={0.8} filter="url(#epic-glow)" />
      )}
      {rarity === "legendary" && (
        <>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.border} strokeWidth={3} opacity={0.9} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const px = size / 2 + (r + 2) * Math.cos(rad);
            const py = size / 2 + (r + 2) * Math.sin(rad);
            return (
              <circle key={deg} cx={px} cy={py} r={1.5} fill={c.border} opacity={0.85} />
            );
          })}
        </>
      )}
      <defs>
        <filter id="epic-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Frame Preview (real decoration asset)                              */
/* ------------------------------------------------------------------ */

function FramePreview({
  imageUrl,
  rarity,
  size = 80,
  className = "",
}: {
  imageUrl: string;
  rarity: StoreRarity;
  size?: number;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  if (!imageUrl || errored) {
    return <DecorationRing rarity={rarity} size={size} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      width={size}
      height={size}
      alt=""
      draggable={false}
      onError={() => setErrored(true)}
      className={`select-none max-w-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Breathing glow backdrop                                            */
/* ------------------------------------------------------------------ */

function BreathingGlow({ color, size = 96 }: { color: string; size?: number }) {
  return (
    <motion.div
      aria-hidden
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        filter: "blur(18px)",
      }}
      animate={{ scale: [1, 1.05, 1], opacity: [0.35, 0.55, 0.35] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Coint count down display (for the header balance)                  */
/* ------------------------------------------------------------------ */

function useAnimatedNumber(value: number) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) return;
    prev.current = value;
    const duration = 450;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return display;
}

/* ------------------------------------------------------------------ */
/*  StoreItem Card                                                     */
/* ------------------------------------------------------------------ */

function StoreItemCard({
  item,
  onBuy,
  onEquip,
  onUnequip,
  onSelect,
  processing,
  error,
  justPurchased,
  reduced,
}: {
  item: StoreItem;
  onBuy: () => void;
  onEquip: () => void;
  onUnequip: () => void;
  onSelect: () => void;
  processing: string | null;
  error: string | null;
  justPurchased: boolean;
  reduced: boolean;
}) {
  const c = RARITY_COLORS[rarityOf(item.rarity)];
  const isProcessing = processing === item.id;

  return (
    <motion.div variants={reduced ? {} : fadeUp} className="relative">
      {/* ambient rarity glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-2xl opacity-60"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${c.glow}, transparent 70%)`, transition: "opacity .3s" }}
      />

      {/* glass card */}
      <TiltCard reduced={reduced}>
        <motion.div
          whileHover={reduced ? undefined : { boxShadow: `0 14px 40px -12px ${c.glow}` }}
          onClick={onSelect}
          animate={
            justPurchased
              ? { boxShadow: [`0 0 0px ${c.glow}`, `0 0 30px ${c.glow}`, `0 14px 40px -12px ${c.glow}`], opacity: [1, 1, 1] }
              : undefined
          }
          transition={justPurchased ? { duration: 0.9, times: [0, 0.4, 1] } : undefined}
          className="relative flex cursor-pointer flex-col items-center gap-2 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-center backdrop-blur-md transition-colors hover:border-white/[0.14]"
        >
          {/* icon bubble */}
          <div
            className="relative flex h-[86px] w-[86px] items-center justify-center rounded-full"
            style={{ background: c.bg, boxShadow: `0 0 24px -8px ${c.glow}` }}
          >
            <BreathingGlow color={c.glow} size={96} />
            <div className="relative z-10 flex items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10" style={{ width: 64, height: 64 }}>
              <FramePreview imageUrl={item.imageUrl} rarity={rarityOf(item.rarity)} size={64} className="relative" />
            </div>
            {justPurchased && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute -right-1 -top-1 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--green)]"
              >
                <Check size={13} className="text-black" strokeWidth={3} />
              </motion.div>
            )}
          </div>

          <span className="relative text-xs text-[var(--text-secondary)]">{item.name}</span>

          <span
            className="relative rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: c.bg, color: c.border, border: `1px solid ${c.border}33` }}
          >
            {c.label}
          </span>

          {item.equipped ? (
            <span className="relative mt-1 flex items-center gap-1 rounded-full bg-[var(--green-bg)] px-2.5 py-1 text-[10px] font-semibold text-[var(--green)]">
              <Check size={10} /> Equipado
            </span>
          ) : item.owned ? (
            <span className="relative mt-1 flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-medium text-[var(--text-muted)]">
              Possuído
            </span>
          ) : (
            <span className="relative mt-1 flex items-center gap-1.5 text-[11px] text-yellow-400">
              <CoinIcon size={17} />
              {item.price}
            </span>
          )}

          {error && (
            <motion.span
              initial={{ opacity: 0, y: -4, x: 0 }}
              animate={{ opacity: 1, y: 0, x: [0, -5, 5, -5, 5, 0] }}
              transition={{ duration: 0.45 }}
              className="relative flex w-full items-center justify-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-center text-[9px] text-red-300"
            >
              <AlertCircle size={9} /> {error}
            </motion.span>
          )}

          <div className="relative mt-1 w-full" onClick={(e) => e.stopPropagation()}>
            {item.equipped ? (
              <button
                onClick={onUnequip}
                disabled={!!processing}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 text-[10px] text-[var(--text-muted)] transition hover:bg-white/[0.06]"
              >
                {isProcessing ? <Loader2 size={11} className="animate-spin" /> : "Desquipar"}
              </button>
            ) : item.owned ? (
              <button
                onClick={onEquip}
                disabled={!!processing}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] font-semibold transition"
                style={{ background: c.bg, color: c.border, border: `1px solid ${c.border}33` }}
              >
                {isProcessing ? <Loader2 size={11} className="animate-spin" /> : "Equipar"}
              </button>
            ) : (
              <button
                onClick={onBuy}
                disabled={!!processing}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-yellow-500/10 py-2 text-[10px] font-semibold text-yellow-400 transition hover:bg-yellow-500/20 disabled:opacity-40"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={11} className="animate-spin" /> Comprando...
                  </>
                ) : justPurchased ? (
                  <>
                    <Check size={11} strokeWidth={3} /> Adquirido!
                  </>
                ) : (
                  <>
                    <CoinIcon size={15} /> Comprar · {item.price}
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </TiltCard>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Decoration Preview Modal                                           */
/* ------------------------------------------------------------------ */

function DecorationModal({
  item,
  user,
  onClose,
  onBuy,
  onEquip,
  onUnequip,
  processing,
  error,
}: {
  item: StoreItem;
  user: { photoURL: string | null; displayName: string | null };
  onClose: () => void;
  onBuy: () => void;
  onEquip: () => void;
  onUnequip: () => void;
  processing: string | null;
  error: string | null;
}) {
  const c = RARITY_COLORS[rarityOf(item.rarity)];
  const isProcessing = processing === item.id;
  const avatarSize = 88;
  const frameAsset = FRAME_ASSETS[item.id];
  const overscale = frameAsset?.overscale ?? 1.38;
  const ringSize = Math.round(avatarSize * overscale);

  return (
    <Modal onClose={onClose}>
      <div
        className="glass-card relative w-full max-w-sm overflow-hidden p-6"
        style={{ border: `1px solid ${c.border}22` }}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)]"
        >
          <X size={16} />
        </button>

        <div className="mb-5 flex flex-col items-center text-center">
          <div className="relative mb-4 flex items-center justify-center" style={{ width: ringSize, height: ringSize }}>
            <FramePreview
              imageUrl={item.imageUrl}
              rarity={rarityOf(item.rarity)}
              size={ringSize}
              className="pointer-events-none absolute select-none z-0"
            />
            <div className="relative z-10 flex items-center justify-center">
              {user.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photoURL}
                  alt="Avatar"
                  className="rounded-full object-cover"
                  style={{ width: avatarSize, height: avatarSize }}
                />
              ) : (
                <div
                  className="flex items-center justify-center rounded-full bg-white/10 font-display text-2xl text-white/60"
                  style={{ width: avatarSize, height: avatarSize }}
                >
                  {(user.displayName ?? "U")
                    .split(" ")
                    .map((w: string) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <h3 className="font-display text-lg text-[var(--text)]">{item.name}</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{item.description}</p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: c.bg, color: c.border }}
            >
              {c.label}
            </span>
            {!item.owned && (
              <span className="flex items-center gap-1.5 text-[11px] text-yellow-400">
                <CoinIcon size={16} /> {item.price}
              </span>
            )}
          </div>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 flex items-center justify-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-center text-xs text-red-300"
          >
            <AlertCircle size={12} /> {error}
          </motion.p>
        )}

        <div className="flex gap-2">
          {item.equipped ? (
            <button
              onClick={onUnequip}
              disabled={isProcessing}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-xs text-[var(--text-muted)] transition hover:bg-white/[0.06]"
            >
              {isProcessing ? <Loader2 size={13} className="animate-spin" /> : "Desquipar"}
            </button>
          ) : item.owned ? (
            <button
              onClick={onEquip}
              disabled={isProcessing}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition"
              style={{ background: c.bg, color: c.border }}
            >
              {isProcessing ? <Loader2 size={13} className="animate-spin" /> : "Equipar"}
            </button>
          ) : (
            <button
              onClick={onBuy}
              disabled={isProcessing}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-yellow-500/10 py-2.5 text-xs font-semibold text-yellow-400 transition hover:bg-yellow-500/20 disabled:opacity-40"
            >
              {isProcessing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <>
                  <CoinIcon size={16} /> Comprar por {item.price}
                </>
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-xs text-[var(--text-muted)] transition hover:bg-white/[0.06]"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Section header                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({
  icon,
  color,
  title,
  delay = 0,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="mb-5 flex items-center gap-2"
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-lg"
        style={{ background: `${color}1a`, color, boxShadow: `0 0 18px -4px ${color}` }}
      >
        {icon}
      </span>
      <span
        className="text-xs font-semibold uppercase tracking-[0.18em]"
        style={{ color }}
      >
        {title}
      </span>
      <span className="ml-1 h-px flex-1" style={{ background: `linear-gradient(90deg, ${color}66, transparent)` }} />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LojaPage() {
  const { user, loading: authLoading } = useAuthRedirect({ ifGuest: "/" });
  const [store, setStore] = useState<{
    items: StoreItem[];
    balance: number;
    banner: { hasCustomBanner: boolean; bannerImageUrl: string | null; unlocked: boolean };
    shieldCount: number;
    xpBoostQuantity: number;
    xpBoost: ActiveXPBoost | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
  const [feedback, setFeedback] = useState("");
  const [cardError, setCardError] = useState<{ id: string; message: string } | null>(null);
  const [justPurchased, setJustPurchased] = useState<string | null>(null);
  const [xpCelebration, setXpCelebration] = useState<{ expiresAt: string; extended: boolean } | null>(null);
  const [boostTick, setBoostTick] = useState(0);
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const xpBoostUseLockRef = useRef(false);
  const reduced = useReducedMotion();
  const [ownedAuras, setOwnedAuras] = useState<string[]>(["flame", "water"]);
  const [shieldDesigns, setShieldDesigns] = useState<{
    designs: StreakShieldDesign[];
    owned: string[];
    equipped: string | null;
  } | null>(null);

  // Animated header balance
  const animatedBalance = useAnimatedNumber(store?.balance ?? 0);

  function flash(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 2000);
  }

  function clearCardError() {
    setCardError(null);
  }

  function markJustPurchased(id: string) {
    setJustPurchased(id);
    setTimeout(() => setJustPurchased((cur) => (cur === id ? null : cur)), 1400);
  }

  async function fetchStore() {
    try {
      const [data, boost, shieldData] = await Promise.all([
        api.getStore(),
        api.getXpBoost().catch(() => ({ quantity: 0, itemType: "xp_boost_2x", boost: null })),
        api.getStreakShieldDesigns().catch(() => ({ designs: [], owned: [], equipped: null })),
      ]);
      setStore({
        ...data,
        xpBoostQuantity: boost.quantity,
        xpBoost: boost.boost,
      });
      if (data.ownedAuras) setOwnedAuras(data.ownedAuras);
      setShieldDesigns(shieldData);
    } catch {
      setError("Não foi possível carregar a loja.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    fetchStore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Re-enable "Usar poção" when the 60-minute timer ends, without a page refresh.
  useEffect(() => {
    const expiresAt = store?.xpBoost?.expiresAt;
    if (!expiresAt) {
      xpBoostUseLockRef.current = false;
      return;
    }

    const remainingMs = new Date(expiresAt).getTime() - Date.now();
    const timeout = setTimeout(() => {
      xpBoostUseLockRef.current = false;
      setStore((s) => (s?.xpBoost ? { ...s, xpBoost: null } : s));
    }, Math.max(0, remainingMs));
    const interval = setInterval(() => setBoostTick((n) => n + 1), 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [store?.xpBoost?.expiresAt]);

  const boostRemaining = useMemo(() => {
    if (!store?.xpBoost?.expiresAt) return 0;
    return Math.max(0, Math.floor((new Date(store.xpBoost.expiresAt).getTime() - Date.now()) / 1000));
  }, [store?.xpBoost?.expiresAt, boostTick]);

  if (authLoading || loading || !store) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
        </div>
      </AppShell>
    );
  }

  /* ─── Actions ─────────────────────────────────────────────── */

  async function handleBuyDecoration(id: string) {
    setProcessing(id);
    setCardError(null);
    try {
      const { balance } = await api.purchaseDecoration(id);
      setStore((s) => (s ? { ...s, balance, items: s.items.map((it) => (it.id === id ? { ...it, owned: true } : it)) } : s));
      markJustPurchased(id);
      flash("Compra realizada!");
    } catch (e) {
      setCardError({ id, message: e instanceof Error ? e.message : "Erro ao comprar decoração." });
    } finally {
      setProcessing(null);
    }
  }

  async function handleEquipDecoration(id: string) {
    setProcessing(id);
    setCardError(null);
    try {
      await api.equipDecoration(id);
      setStore((s) =>
        s ? { ...s, items: s.items.map((it) => ({ ...it, equipped: it.id === id ? true : false })) } : s,
      );
      flash("Equipado!");
    } catch (e) {
      setCardError({ id, message: e instanceof Error ? e.message : "Erro ao equipar decoração." });
    } finally {
      setProcessing(null);
    }
  }

  async function handleUnequipDecoration() {
    if (!store) return;
    const equipped = store.items.find((it) => it.equipped);
    if (!equipped) return;
    setProcessing(equipped.id);
    setCardError(null);
    try {
      await api.equipDecoration(null);
      setStore((s) => (s ? { ...s, items: s.items.map((it) => ({ ...it, equipped: false })) } : s));
      flash("Desquipado!");
    } catch (e) {
      setCardError({ id: equipped.id, message: e instanceof Error ? e.message : "Erro ao desquipar decoração." });
    } finally {
      setProcessing(null);
    }
  }

  async function handleUnlockBanner() {
    setProcessing("banner-unlock");
    setCardError(null);
    try {
      const { balance } = await api.unlockBanner();
      setStore((s) => (s ? { ...s, balance, banner: { ...s.banner, unlocked: true } } : s));
      flash("Banner desbloqueado!");
    } catch (e) {
      setCardError({ id: "banner", message: e instanceof Error ? e.message : "Erro ao desbloquear banner." });
    } finally {
      setProcessing(null);
    }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setCardError({ id: "banner", message: "Escolha uma imagem de até 5 MB." });
      return;
    }
    setProcessing("banner-upload");
    setCardError(null);
    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
      if (!cloudName || !uploadPreset) {
        throw new Error("Cloudinary is not configured");
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      await api.updateBannerImage(data.secure_url);
      setStore((s) => (s ? { ...s, banner: { ...s.banner, bannerImageUrl: data.secure_url, hasCustomBanner: true } } : s));
      flash("Banner atualizado!");
    } catch {
      setCardError({ id: "banner", message: "Erro ao enviar banner." });
    } finally {
      setProcessing(null);
      if (bannerFileRef.current) bannerFileRef.current.value = "";
    }
  }

  async function handleBuyAura(type: string) {
    setProcessing(`aura-${type}`);
    setCardError(null);
    try {
      const { balance } = await api.purchaseAura(type);
      setStore((s) => (s ? { ...s, balance } : s));
      setOwnedAuras((prev) => [...prev, type]);
      markJustPurchased(type);
      flash(`${ENERGY_CONFIGS[type as EnergyType]?.label ?? type} comprado!`);
    } catch (e) {
      setCardError({ id: `aura-${type}`, message: e instanceof Error ? e.message : "Erro ao comprar energia." });
    } finally {
      setProcessing(null);
    }
  }

  async function handleBuyShield() {
    setProcessing("shield-buy");
    setCardError(null);
    try {
      const { balance, shieldCount } = await api.purchaseShield();
      setStore((s) => (s ? { ...s, balance, shieldCount } : s));
      flash("Escudo comprado!");
    } catch (e) {
      setCardError({ id: "shield", message: e instanceof Error ? e.message : "Erro ao comprar escudo." });
    } finally {
      setProcessing(null);
    }
  }

  async function handleBuyShieldDesign(shieldDesignId: string) {
    if (!shieldDesigns) return;
    setProcessing(`shield-design-${shieldDesignId}`);
    setCardError(null);
    try {
      const { balance, ownedDesigns } = await api.purchaseStreakShieldDesign(shieldDesignId);
      setStore((s) => (s ? { ...s, balance } : s));
      setShieldDesigns((prev) => prev ? { ...prev, owned: ownedDesigns } : null);
      flash("Design de escudo comprado!");
      markJustPurchased(shieldDesignId);
    } catch (e) {
      setCardError({ id: "shield-design", message: e instanceof Error ? e.message : "Erro ao comprar design de escudo." });
    } finally {
      setProcessing(null);
    }
  }

  async function handleEquipShieldDesign(shieldDesignId: string) {
    if (!shieldDesigns) return;
    setProcessing(`shield-equip-${shieldDesignId}`);
    setCardError(null);
    try {
      await api.equipStreakShieldDesign(shieldDesignId);
      setShieldDesigns((prev) => prev ? { ...prev, equipped: shieldDesignId } : null);
      flash("Design de escudo equipado!");
    } catch (e) {
      setCardError({ id: "shield-equip", message: e instanceof Error ? e.message : "Erro ao equipar design de escudo." });
    } finally {
      setProcessing(null);
    }
  }

  async function handleBuyXpBoost() {
    setProcessing("xp-boost-buy");
    setCardError(null);
    try {
      const { balance, quantity } = await api.purchaseXpBoost();
      setStore((s) => (s ? { ...s, balance, xpBoostQuantity: quantity } : s));
      flash("Poção de XP Duplo comprada!");
    } catch (e) {
      setCardError({ id: "xp-boost", message: e instanceof Error ? e.message : "Erro ao comprar poção." });
    } finally {
      setProcessing(null);
    }
  }

  async function handleUseXpBoost() {
    // Ref lock first: setState is async, so a same-tick double-click would both
    // see processing === null and fire two activations without this.
    if (xpBoostUseLockRef.current) return;
    if (!store || isXpBoostActive(store.xpBoost) || store.xpBoostQuantity <= 0) return;

    xpBoostUseLockRef.current = true;
    setProcessing("xp-boost-use");
    setCardError(null);
    try {
      const { boost, quantity } = await api.activateXpBoost();
      setStore((s) => (s ? { ...s, xpBoostQuantity: quantity, xpBoost: boost } : s));
      setXpCelebration({ expiresAt: boost.expiresAt, extended: false });
    } catch (e) {
      xpBoostUseLockRef.current = false;
      setCardError({ id: "xp-boost", message: e instanceof Error ? e.message : "Erro ao usar poção." });
    } finally {
      setProcessing(null);
    }
  }

  /* ─── Derived ─────────────────────────────────────────────── */

  const equippedItem = store.items.find((it) => it.equipped);
  const xpBoostActive = isXpBoostActive(store.xpBoost);
  const xpBoostUseDisabled =
    xpBoostActive || store.xpBoostQuantity <= 0 || processing === "xp-boost-use";

  /* ─── Render ──────────────────────────────────────────────── */

  return (
    <AppShell>
      <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <Header eyebrow="PERSONALIZAÇÃO" title="Loja" />

          {/* ─── Coin Balance ────────────────────────────────── */}
          <div className="mb-7 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/20 ring-1 ring-yellow-500/30">
              <CoinIcon size={24} />
            </div>
            <span className="font-display text-3xl text-yellow-400">
              {animatedBalance.toLocaleString("pt-BR")}
            </span>
            <span className="text-sm text-[var(--text-muted)]">moedas</span>
            {feedback && (
              <motion.span
                key={feedback}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="ml-2 text-xs font-medium text-[var(--green)]"
              >
                {feedback}
              </motion.span>
            )}
          </div>

          {/* ─── Error Banner ───────────────────────────────── */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-center gap-2 rounded-xl border border-[var(--red)]/20 bg-[var(--red-bg)] px-4 py-3 text-sm text-[var(--red)]"
            >
              <X size={14} className="cursor-pointer" onClick={() => setError("")} />
              {error}
            </motion.div>
          )}

          {/* ─── Section 1: Banners de Perfil ─────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass-card mb-8 relative overflow-hidden p-6 backdrop-blur-xl sm:p-8"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full opacity-50"
              style={{ background: "radial-gradient(ellipse, rgba(113,212,255,.25), transparent 70%)", filter: "blur(20px)" }}
            />
            <SectionHeader icon={<ImageIcon size={14} />} color="#71d4ff" title="Banners de Perfil" delay={0.05} />

            <input ref={bannerFileRef} type="file" accept="image/*" onChange={handleBannerUpload} className="sr-only" />

            {!store.banner.unlocked ? (
              <>
                <div className="relative mb-4 aspect-[3/1] w-full overflow-hidden rounded-xl">
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, rgba(113,212,255,0.1), rgba(182,156,255,0.1), rgba(255,184,107,0.1))",
                      filter: "blur(8px)",
                    }}
                  >
                    <span className="text-xs text-white/20">???</span>
                  </div>
                </div>
                <p className="mb-4 text-sm text-[var(--text-muted)]">
                  Desbloqueie um banner personalizado para seu perfil
                </p>

                {cardError?.id === "banner" && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-3 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300"
                  >
                    <AlertCircle size={12} /> {cardError.message}
                  </motion.p>
                )}

                <button
                  onClick={handleUnlockBanner}
                  disabled={processing === "banner-unlock" || store.balance < 1500}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-bg)] py-3 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/15 disabled:opacity-40"
                >
                  {processing === "banner-unlock" ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <>
                      <CoinIcon size={16} /> Desbloquear por 1500 moedas
                    </>
                  )}
                </button>
              </>
            ) : store.banner.bannerImageUrl ? (
              <>
                <div className="mb-4 aspect-[3/1] w-full overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={store.banner.bannerImageUrl} alt="Banner do perfil" className="h-full w-full object-cover" />
                </div>
                <button
                  onClick={() => bannerFileRef.current?.click()}
                  disabled={processing === "banner-upload"}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-3 text-xs text-[var(--text-muted)] transition hover:bg-white/[0.06]"
                >
                  {processing === "banner-upload" ? <Loader2 size={13} className="animate-spin" /> : <><Upload size={13} /> Trocar banner</>}
                </button>
              </>
            ) : (
              <>
                <div className="mb-4 aspect-[3/1] w-full overflow-hidden rounded-xl">
                  <div className="flex h-full w-full items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(113,212,255,0.06), rgba(182,156,255,0.06))" }}>
                    <ImageIcon size={24} className="text-white/10" />
                  </div>
                </div>
                <button
                  onClick={() => bannerFileRef.current?.click()}
                  disabled={processing === "banner-upload"}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-3 text-xs text-[var(--text-muted)] transition hover:bg-white/[0.06]"
                >
                  {processing === "banner-upload" ? <Loader2 size={13} className="animate-spin" /> : <><Upload size={13} /> Enviar banner</>}
                </button>
              </>
            )}
          </motion.section>

          {/* ─── Section 2: Molduras de Avatar ─────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="glass-card mb-8 relative overflow-hidden p-6 backdrop-blur-xl sm:p-8"
          >
            <SectionHeader icon={<Frame size={14} />} color="#b69cff" title="Molduras de Avatar" delay={0.1} />

            {store.items.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                Nenhuma moldura disponível ainda.
              </p>
            ) : (
              <motion.div
                variants={reduced ? {} : stagger}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
              >
                {store.items.map((item) => (
                  <StoreItemCard
                    key={item.id}
                    item={item}
                    processing={processing}
                    error={cardError?.id === item.id ? cardError.message : null}
                    justPurchased={justPurchased === item.id}
                    reduced={!!reduced}
                    onBuy={() => handleBuyDecoration(item.id)}
                    onEquip={() => handleEquipDecoration(item.id)}
                    onUnequip={handleUnequipDecoration}
                    onSelect={() => { setSelectedItem(item); clearCardError(); }}
                  />
                ))}
              </motion.div>
            )}
          </motion.section>

          {/* ─── Section 3: Escudo de Streak ─────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="glass-card mb-8 relative overflow-hidden p-6 backdrop-blur-xl sm:p-8"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full opacity-50"
              style={{ background: "radial-gradient(ellipse, rgba(74,222,128,.2), transparent 70%)", filter: "blur(20px)" }}
            />
            <SectionHeader icon={<Shield size={14} />} color="#4ade80" title="Proteção de Streak" delay={0.2} />

            <p className="mb-5 text-sm text-[var(--text-muted)]">
              Proteja sua sequência! Se você esquecer de completar tarefas em um dia, o escudo mantém sua streak automaticamente.
            </p>

            <div className="mb-4 flex items-center gap-3">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      background: i < store.shieldCount ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.04)",
                      border: i < store.shieldCount ? "1px solid rgba(74,222,128,0.3)" : "1px dashed rgba(255,255,255,0.1)",
                    }}
                  >
                    <Shield
                      size={14}
                      style={{
                        color: i < store.shieldCount ? "var(--green)" : "var(--text-faint)",
                        fill: i < store.shieldCount ? "var(--green)" : "transparent",
                      }}
                    />
                  </div>
                ))}
              </div>
              <span className="text-xs text-[var(--text-muted)]">{store.shieldCount} de 3 escudos</span>
            </div>

            <p className="mb-4 text-xs text-[var(--text-faint)]">200 moedas cada</p>

            {cardError?.id === "shield" && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-3 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300"
              >
                <AlertCircle size={12} /> {cardError.message}
              </motion.p>
            )}

            <button
              onClick={handleBuyShield}
              disabled={processing === "shield-buy" || store.balance < 200 || store.shieldCount >= 3}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--green-bg)] py-3 text-xs font-semibold text-[var(--green)] transition hover:bg-[var(--green)]/15 disabled:opacity-40"
            >
              {processing === "shield-buy" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <><CoinIcon size={16} /> Comprar escudo · 200</>
              )}
            </button>
          </motion.section>

          {/* ─── Section: Designs de Escudos ─────────────── */}
          {shieldDesigns && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="glass-card mb-8 relative overflow-hidden p-6 backdrop-blur-xl sm:p-8"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -top-16 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full opacity-50"
                style={{ background: "radial-gradient(ellipse, rgba(113,212,255,.2), transparent 70%)", filter: "blur(20px)" }}
              />
              <SectionHeader icon={<Shield size={14} />} color="#71d4ff" title="Designs de Escudos" delay={0.35} />

              <p className="mb-5 text-sm text-[var(--text-muted)]">
                Personalize seus escudos de proteção de streak com designs únicos!
              </p>

              {cardError?.id === "shield-design" && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-3 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300"
                >
                  <AlertCircle size={12} /> {cardError.message}
                </motion.p>
              )}
              {cardError?.id === "shield-equip" && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-3 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300"
                >
                  <AlertCircle size={12} /> {cardError.message}
                </motion.p>
              )}

              <motion.div
                variants={stagger.container}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
              >
                {shieldDesigns.designs.map((design) => {
                  const owned = shieldDesigns.owned.includes(design.id);
                  const equipped = shieldDesigns.equipped === design.id;
                  const rarity = RARITY_COLORS[design.rarity as keyof typeof RARITY_COLORS] || RARITY_COLORS.common;
                  const isProcessing = processing === `shield-design-${design.id}` || processing === `shield-equip-${design.id}`;
                  
                  return (
                    <motion.div key={design.id} variants={stagger.item} className="relative">
                      <div
                        className={`relative h-28 w-full overflow-hidden rounded-xl border transition-all ${equipped ? "ring-2 ring-[var(--accent)]" : ""}`}
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          borderColor: rarity.border + (owned ? "80" : "30"),
                        }}
                      >
                        {/* Glow effect for equipped */}
                        {equipped && (
                          <div
                            aria-hidden
                            className="pointer-events-none absolute inset-0 rounded-xl"
                            style={{
                              background: `radial-gradient(circle at center, ${rarity.glow} 0%, transparent 70%)`,
                              filter: "blur(10px)",
                            }}
                          />
                        )}

                        {/* Shield design image */}
                        <div className="relative z-10 flex h-full items-center justify-center p-2">
                          <img
                            src={design.iconUrl}
                            alt={design.name}
                            className="h-16 w-16 object-contain"
                            draggable={false}
                          />
                        </div>

                        {/* Owned indicator */}
                        {owned && (
                          <div className="absolute right-1 top-1 z-20 rounded-full bg-[var(--accent)]/20 p-1">
                            <Check size={10} className="text-[var(--accent)]" />
                          </div>
                        )}

                        {/* Just purchased animation */}
                        {justPurchased === design.id && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-[var(--accent)]/10"
                          >
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="rounded-full bg-[var(--accent)] p-2"
                            >
                              <Check size={16} className="text-white" />
                            </motion.div>
                          </motion.div>
                        )}

                        {/* Processing overlay */}
                        {isProcessing && (
                          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/30 backdrop-blur-sm">
                            <Loader2 size={16} className="animate-spin text-white" />
                          </div>
                        )}

                        {/* Rarity indicator */}
                        <div className="absolute bottom-1 left-1 z-20 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                             style={{
                               background: rarity.bg,
                               color: rarity.border,
                               border: `1px solid ${rarity.border}`
                             }}>
                          {rarity.label}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-[var(--text)]">{design.name}</span>
                          <span className="text-[10px] text-[var(--text-muted)] line-clamp-1">{design.description}</span>
                        </div>
                        <span className="text-xs font-semibold text-amber-300">{design.price} moedas</span>
                      </div>

                      {owned ? (
                        <button
                          onClick={() => handleEquipShieldDesign(design.id)}
                          disabled={isProcessing || equipped}
                          className="mt-2 w-full rounded-lg bg-[var(--bg-surface-hover)] py-2 text-xs font-semibold transition hover:bg-[var(--bg-surface)] disabled:opacity-50"
                          style={{
                            color: equipped ? "var(--accent)" : "var(--text)",
                            border: equipped ? "1px solid var(--accent-border)" : "none"
                          }}
                        >
                          {equipped ? "✓ Equipado" : "Equipar"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBuyShieldDesign(design.id)}
                          disabled={isProcessing || store!.balance < design.price}
                          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--bg-surface-hover)] py-2 text-xs font-semibold transition hover:bg-[var(--bg-surface)] disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <>
                              <CoinIcon size={12} /> Comprar
                            </>
                          )}
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            </motion.section>
          )}

          {/* ─── Section: Poção de XP Duplo ─────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="glass-card mb-8 relative overflow-hidden p-6 backdrop-blur-xl sm:p-8"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full opacity-50"
              style={{ background: `radial-gradient(ellipse, ${XP_BOOST_ITEM.glow}, transparent 70%)`, filter: "blur(20px)" }}
            />
            <SectionHeader icon={<FlaskConical size={14} />} color={XP_BOOST_ITEM.accent} title={XP_BOOST_ITEM.name} delay={0.25} />

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              {/* Icon */}
              <div className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]"
                style={{ boxShadow: `0 0 28px -6px ${XP_BOOST_ITEM.glow}` }}>
                <Image
                  src={XP_BOOST_ITEM.iconPath}
                  alt={XP_BOOST_ITEM.name}
                  width={64}
                  height={64}
                  className="object-contain"
                  unoptimized
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
                <FlaskConical size={40} className="absolute text-[var(--text-faint)]" style={{ display: "none" }} />
                <Zap size={16} className="absolute -right-1 -top-1 text-[#ffb86b]" fill="currentColor" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="mb-2 text-sm text-[var(--text-muted)]">{XP_BOOST_ITEM.description}</p>

                {/* Owned count + active boost */}
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-xs text-[var(--text-secondary)]">
                    Você possui: <strong className="text-[#b69cff]">{store.xpBoostQuantity} / {XP_BOOST_MAX_HELD}</strong>
                  </span>
                  {xpBoostActive && (
                    <motion.span
                      animate={{ opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="flex items-center gap-1 rounded-full border border-[#b69cff]/40 bg-[#b69cff]/10 px-2 py-0.5 text-[10px] font-semibold text-[#b69cff]"
                    >
                      <Zap size={11} fill="currentColor" /> 2x XP ativo
                      {boostRemaining > 0 && (
                        <span className="font-mono font-medium text-[#b69cff]/80">
                          · {formatRemaining(boostRemaining)}
                        </span>
                      )}
                    </motion.span>
                  )}
                </div>

                <p className="mb-4 text-xs text-[var(--text-faint)]">
                  {XP_BOOST_ITEM.price} moedas cada · dura {Math.round(XP_BOOST_DURATION_MS / 60000)} minutos
                </p>

                {cardError?.id === "xp-boost" && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-3 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300"
                  >
                    <AlertCircle size={12} /> {cardError.message}
                  </motion.p>
                )}

                <div className="flex flex-wrap gap-2">
                  {/* Use button */}
                  <button
                    onClick={handleUseXpBoost}
                    disabled={xpBoostUseDisabled}
                    title={xpBoostActive ? "Poção já ativa" : undefined}
                    aria-label={xpBoostActive ? "Poção já ativa" : "Usar poção"}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#b69cff]/20 px-4 py-2.5 text-xs font-semibold text-[#b69cff] transition hover:bg-[#b69cff]/30 disabled:opacity-40"
                  >
                    {processing === "xp-boost-use" ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : xpBoostActive ? (
                      <>Poção já ativa</>
                    ) : (
                      <><Zap size={14} /> Usar poção</>
                    )}
                  </button>

                  {/* Buy button — cap-aware */}
                  {store.xpBoostQuantity >= XP_BOOST_MAX_HELD ? (
                    <span className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-[var(--text-faint)]">
                      <Lock size={13} /> Inventário cheio ({XP_BOOST_MAX_HELD}/{XP_BOOST_MAX_HELD})
                    </span>
                  ) : (
                    <button
                      onClick={handleBuyXpBoost}
                      disabled={processing === "xp-boost-buy" || store.balance < XP_BOOST_ITEM.price}
                      className="flex items-center justify-center gap-2 rounded-xl bg-[var(--green-bg)] px-4 py-2.5 text-xs font-semibold text-[var(--green)] transition hover:bg-[var(--green)]/15 disabled:opacity-40"
                    >
                      {processing === "xp-boost-buy" ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <><CoinIcon size={15} /> Comprar · {XP_BOOST_ITEM.price}</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.section>

          {/* ─── Section 4: Auras ─────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="glass-card mb-8 relative overflow-hidden p-6 backdrop-blur-xl sm:p-8"
          >
            <SectionHeader icon={<Sparkles size={14} />} color="#ffd76b" title="Auras" delay={0.3} />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ENERGY_TYPES.map((type) => {
                const info = AURA_DEFS[type];
                const rc = AURA_RARITY_COLORS[info.rarity];
                const rarity = rarityOf(info.rarity);
                const storedRarity = RARITY_COLORS[rarity];
                const isOwned = ownedAuras.includes(type);
                const isProcessing = processing === `aura-${type}`;
                const err = cardError?.id === `aura-${type}` ? cardError.message : null;
                const purchased = justPurchased === type;
                return (
                  <motion.div
                    key={type}
                    variants={reduced ? {} : fadeUp}
                    className="relative"
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -inset-1 rounded-2xl opacity-60"
                      style={{ background: `radial-gradient(ellipse at 50% 0%, ${storedRarity.glow}, transparent 70%)` }}
                    />
                    <TiltCard reduced={!!reduced}>
                      <motion.div
                        whileHover={reduced ? undefined : { boxShadow: `0 14px 40px -12px ${storedRarity.glow}` }}
                        animate={
                          purchased
                            ? { boxShadow: [`0 0 0px ${storedRarity.glow}`, `0 0 30px ${storedRarity.glow}`, `0 14px 40px -12px ${storedRarity.glow}`], opacity: [1, 1, 1] }
                            : undefined
                        }
                        transition={purchased ? { duration: 0.9, times: [0, 0.4, 1] } : undefined}
                        className="relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl border p-4 text-center backdrop-blur-md"
                        style={{
                          borderColor: isOwned ? `${storedRarity.border}33` : "var(--border-subtle)",
                          background: isOwned ? storedRarity.bg : "rgba(255,255,255,0.03)",
                        }}
                      >
                        <div className="relative flex h-16 w-16 items-center justify-center">
                          <BreathingGlow color={storedRarity.glow} size={72} />
                          <Image
                            src={ENERGY_CONFIGS[type].assets.full}
                            alt={info.label}
                            width={60}
                            height={60}
                            style={{ objectFit: "contain", opacity: isOwned ? 1 : 0.35, position: "relative" }}
                            unoptimized
                          />
                          {!isOwned && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Lock size={18} className="text-[var(--text-faint)]" />
                            </div>
                          )}
                          {purchased && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="absolute -right-1 -top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--green)]"
                            >
                              <Check size={12} className="text-black" strokeWidth={3} />
                            </motion.div>
                          )}
                        </div>
                        <span className="text-xs font-medium text-[var(--text-secondary)]">{info.label}</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: storedRarity.bg, color: storedRarity.border, border: `1px solid ${storedRarity.border}33` }}
                        >
                          {AURA_RARITY_LABELS[info.rarity]}
                        </span>

                        {err && (
                          <motion.span
                            initial={{ opacity: 0, y: -4, x: 0 }}
                            animate={{ opacity: 1, y: 0, x: [0, -5, 5, -5, 5, 0] }}
                            transition={{ duration: 0.45 }}
                            className="flex w-full items-center justify-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-center text-[9px] text-red-300"
                          >
                            <AlertCircle size={9} /> {err}
                          </motion.span>
                        )}

                        {isOwned ? (
                          <span className="flex w-full items-center justify-center gap-1 rounded-lg bg-white/[0.05] py-1.5 text-[10px] font-medium text-[var(--text-muted)]">
                            Possuída
                          </span>
                        ) : (
                          <button
                            onClick={() => handleBuyAura(type)}
                            disabled={!!processing || store.balance < info.price}
                            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] font-semibold transition disabled:opacity-40"
                            style={{ background: storedRarity.bg, color: storedRarity.border }}
                          >
                            {isProcessing ? (
                              <>
                                <Loader2 size={11} className="animate-spin" /> Comprando...
                              </>
                            ) : purchased ? (
                              <>
                                <Check size={11} strokeWidth={3} /> Adquirida!
                              </>
                            ) : (
                              <>
                                <CoinIcon size={15} /> {info.price}
                              </>
                            )}
                          </button>
                        )}
                      </motion.div>
                    </TiltCard>
                  </motion.div>
                );
              })}
            </div>

            {store.balance < 500 && (
              <p className="mt-4 text-center text-[10px] text-[var(--text-faint)]">
                Complete sessões de foco para ganhar moedas.
              </p>
            )}
          </motion.section>
        </div>
      </main>

      {/* ─── XP Boost Celebration ──────────────────────────────── */}
      {xpCelebration && (
        <XpBoostCelebration
          expiresAt={xpCelebration.expiresAt}
          extended={xpCelebration.extended}
          onClose={() => setXpCelebration(null)}
          reduced={!!reduced}
        />
      )}

      {/* ─── Decoration Preview Modal ────────────────────────────── */}
      {selectedItem && user && (
        <DecorationModal
          item={selectedItem}
          user={{ photoURL: user.photoURL, displayName: user.displayName }}
          onClose={() => setSelectedItem(null)}
          error={cardError?.id === selectedItem.id ? cardError.message : null}
          onBuy={() => {
            handleBuyDecoration(selectedItem.id);
            setSelectedItem(null);
          }}
          onEquip={() => {
            handleEquipDecoration(selectedItem.id);
            setSelectedItem(null);
          }}
          onUnequip={() => {
            handleUnequipDecoration();
            setSelectedItem(null);
          }}
          processing={processing}
        />
      )}
    </AppShell>
  );
}
