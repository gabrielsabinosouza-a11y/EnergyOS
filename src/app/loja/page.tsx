"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Image as ImageIcon,
  Frame,
  Shield,
  Sparkles,
  X,
  Loader2,
  Upload,
  Coins,
  Check,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/navigation";
import { Modal } from "@/components/modal";
import { useAuthRedirect } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Image from "next/image";
import { Lock } from "lucide-react";
import {
  AURA_DEFS,
  AURA_RARITY_COLORS,
  AURA_RARITY_LABELS,
  ENERGY_CONFIGS,
  ENERGY_TYPES,
  type EnergyType,
} from "@/lib/energy-assets";
import type { StoreItem, DecorationRarity } from "@/types";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const RARITY_COLORS: Record<
  DecorationRarity,
  { border: string; bg: string; label: string; glow: string }
> = {
  common: {
    border: "#71d4ff",
    bg: "rgba(113,212,255,0.08)",
    label: "Comum",
    glow: "rgba(113,212,255,0.3)",
  },
  rare: {
    border: "#b69cff",
    bg: "rgba(182,156,255,0.08)",
    label: "Rara",
    glow: "rgba(182,156,255,0.3)",
  },
  epic: {
    border: "#ffb86b",
    bg: "rgba(255,184,107,0.08)",
    label: "Épica",
    glow: "rgba(255,184,107,0.3)",
  },
  legendary: {
    border: "#ffd76b",
    bg: "rgba(255,215,107,0.08)",
    label: "Lendária",
    glow: "rgba(255,215,107,0.3)",
  },
};

/* ------------------------------------------------------------------ */
/*  Animation variants                                                */
/* ------------------------------------------------------------------ */

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" as const },
  },
};

/* ------------------------------------------------------------------ */
/*  Decoration Ring Preview                                           */
/* ------------------------------------------------------------------ */

function DecorationRing({
  rarity,
  size = 80,
}: {
  rarity: DecorationRarity;
  size?: number;
}) {
  const c = RARITY_COLORS[rarity];
  const r = size / 2 - 4;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rarity === "common" && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c.border}
          strokeWidth={2}
          opacity={0.7}
        />
      )}
      {rarity === "rare" && (
        <>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={c.border}
            strokeWidth={2}
            opacity={0.6}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r - 5}
            fill="none"
            stroke={c.border}
            strokeWidth={1}
            opacity={0.35}
          />
        </>
      )}
      {rarity === "epic" && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c.border}
          strokeWidth={4}
          opacity={0.8}
          filter="url(#epic-glow)"
        />
      )}
      {rarity === "legendary" && (
        <>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={c.border}
            strokeWidth={3}
            opacity={0.9}
          />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const px = size / 2 + (r + 2) * Math.cos(rad);
            const py = size / 2 + (r + 2) * Math.sin(rad);
            return (
              <circle
                key={deg}
                cx={px}
                cy={py}
                r={1.5}
                fill={c.border}
                opacity={0.85}
              />
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
  rarity: DecorationRarity;
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
      className={`select-none ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  StoreItem Card                                                    */
/* ------------------------------------------------------------------ */

function StoreItemCard({
  item,
  onBuy,
  onEquip,
  onUnequip,
  onSelect,
  processing,
  reduced,
}: {
  item: StoreItem;
  onBuy: () => void;
  onEquip: () => void;
  onUnequip: () => void;
  onSelect: () => void;
  processing: string | null;
  reduced: boolean;
}) {
  const c = RARITY_COLORS[item.rarity];
  const isProcessing = processing === item.id;

  return (
    <motion.div
      variants={reduced ? {} : fadeUp}
      whileHover={reduced ? undefined : { y: -3 }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      onClick={onSelect}
      className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center transition-colors hover:border-white/[0.12]"
    >
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{ width: 80, height: 80, background: c.bg }}
      >
        <div
          className="absolute rounded-full bg-white/10 ring-1 ring-white/10"
          style={{ width: 62, height: 62 }}
        />
        <FramePreview imageUrl={item.imageUrl} rarity={item.rarity} size={80} className="relative" />
      </div>

      <span className="text-xs text-[var(--text-secondary)]">{item.name}</span>

      <span
        className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{
          background: c.bg,
          color: c.border,
          border: `1px solid ${c.border}33`,
        }}
      >
        {c.label}
      </span>

      {item.equipped ? (
        <span className="mt-1 flex items-center gap-1 rounded-full bg-[var(--green-bg)] px-2.5 py-1 text-[10px] font-semibold text-[var(--green)]">
          <Check size={10} />
          Equipado
        </span>
      ) : item.owned ? (
        <span className="mt-1 flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-medium text-[var(--text-muted)]">
          Possuído
        </span>
      ) : (
        <span className="mt-1 flex items-center gap-1 text-[10px] text-yellow-400">
          <Coins size={10} />
          {item.price}
        </span>
      )}

      <div className="mt-1 w-full" onClick={(e) => e.stopPropagation()}>
        {item.equipped ? (
          <button
            onClick={onUnequip}
            disabled={isProcessing}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] py-1.5 text-[10px] text-[var(--text-muted)] transition hover:bg-white/[0.06]"
          >
            {isProcessing ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              "Desquipar"
            )}
          </button>
        ) : item.owned ? (
          <button
            onClick={onEquip}
            disabled={isProcessing}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-semibold transition"
            style={{
              background: c.bg,
              color: c.border,
              border: `1px solid ${c.border}33`,
            }}
          >
            {isProcessing ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              "Equipar"
            )}
          </button>
        ) : (
          <button
            onClick={onBuy}
            disabled={isProcessing}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-yellow-500/10 py-1.5 text-[10px] font-semibold text-yellow-400 transition hover:bg-yellow-500/20 disabled:opacity-40"
          >
            {isProcessing ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              "Comprar"
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Decoration Preview Modal                                          */
/* ------------------------------------------------------------------ */

function DecorationModal({
  item,
  user,
  onClose,
  onBuy,
  onEquip,
  onUnequip,
  processing,
}: {
  item: StoreItem;
  user: { photoURL: string | null; displayName: string | null };
  onClose: () => void;
  onBuy: () => void;
  onEquip: () => void;
  onUnequip: () => void;
  processing: string | null;
}) {
  const c = RARITY_COLORS[item.rarity];
  const isProcessing = processing === item.id;
  const avatarSize = 96;
  const ringSize = 120;

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
          <div className="relative mb-4 flex items-center justify-center">
            <FramePreview
              imageUrl={item.imageUrl}
              rarity={item.rarity}
              size={ringSize}
              className="relative"
            />
            <div className="absolute inset-0 flex items-center justify-center">
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

          <h3 className="font-display text-lg text-[var(--text)]">
            {item.name}
          </h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {item.description}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: c.bg, color: c.border }}
            >
              {c.label}
            </span>
            {!item.owned && (
              <span className="flex items-center gap-1 text-[11px] text-yellow-400">
                <Coins size={10} />
                {item.price}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {item.equipped ? (
            <button
              onClick={onUnequip}
              disabled={isProcessing}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-xs text-[var(--text-muted)] transition hover:bg-white/[0.06]"
            >
              {isProcessing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                "Desquipar"
              )}
            </button>
          ) : item.owned ? (
            <button
              onClick={onEquip}
              disabled={isProcessing}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition"
              style={{ background: c.bg, color: c.border }}
            >
              {isProcessing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                "Equipar"
              )}
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
                  <Coins size={12} />
                  Comprar por {item.price}
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
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function LojaPage() {
  const { user, loading: authLoading } = useAuthRedirect({ ifGuest: "/" });
  const [store, setStore] = useState<{
    items: StoreItem[];
    balance: number;
    banner: {
      hasCustomBanner: boolean;
      bannerImageUrl: string | null;
      unlocked: boolean;
    };
    shieldCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
  const [feedback, setFeedback] = useState("");
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const reduced = useReducedMotion();
  const [ownedAuras, setOwnedAuras] = useState<string[]>(["flame", "water"]);

  function flash(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 2000);
  }

  async function fetchStore() {
    try {
      const data = await api.getStore();
      setStore(data);
      if (data.ownedAuras) setOwnedAuras(data.ownedAuras);
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
    try {
      const { balance } = await api.purchaseDecoration(id);
      setStore((s) =>
        s
          ? {
              ...s,
              balance,
              items: s.items.map((it) =>
                it.id === id ? { ...it, owned: true } : it,
              ),
            }
          : s,
      );
      flash("Compra realizada!");
    } catch {
      setError("Erro ao comprar decoração.");
    } finally {
      setProcessing(null);
    }
  }

  async function handleEquipDecoration(id: string) {
    setProcessing(id);
    try {
      await api.equipDecoration(id);
      setStore((s) =>
        s
          ? {
              ...s,
              items: s.items.map((it) => ({
                ...it,
                equipped: it.id === id ? true : false,
              })),
            }
          : s,
      );
      flash("Equipado!");
    } catch {
      setError("Erro ao equipar decoração.");
    } finally {
      setProcessing(null);
    }
  }

  async function handleUnequipDecoration() {
    if (!store) return;
    const equipped = store.items.find((it) => it.equipped);
    if (!equipped) return;
    setProcessing(equipped.id);
    try {
      await api.equipDecoration(null);
      setStore((s) =>
        s
          ? {
              ...s,
              items: s.items.map((it) => ({ ...it, equipped: false })),
            }
          : s,
      );
      flash("Desquipado!");
    } catch {
      setError("Erro ao desquipar decoração.");
    } finally {
      setProcessing(null);
    }
  }

  async function handleUnlockBanner() {
    setProcessing("banner-unlock");
    try {
      const { balance } = await api.unlockBanner();
      setStore((s) =>
        s
          ? { ...s, balance, banner: { ...s.banner, unlocked: true } }
          : s,
      );
      flash("Banner desbloqueado!");
    } catch {
      setError("Erro ao desbloquear banner.");
    } finally {
      setProcessing(null);
    }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setError("Escolha uma imagem de até 5 MB.");
      return;
    }
    setProcessing("banner-upload");
    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
      if (!cloudName || !uploadPreset) {
        throw new Error("Cloudinary is not configured");
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: formData },
      );
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      await api.updateBannerImage(data.secure_url);
      setStore((s) =>
        s
          ? {
              ...s,
              banner: { ...s.banner, bannerImageUrl: data.secure_url, hasCustomBanner: true },
            }
          : s,
      );
      flash("Banner atualizado!");
    } catch {
      setError("Erro ao enviar banner.");
    } finally {
      setProcessing(null);
      if (bannerFileRef.current) bannerFileRef.current.value = "";
    }
  }

  async function handleBuyAura(type: string) {
    setProcessing(`aura-${type}`);
    try {
      const { balance } = await api.purchaseAura(type);
      setStore((s) => (s ? { ...s, balance } : s));
      setOwnedAuras((prev) => [...prev, type]);
      flash(`${ENERGY_CONFIGS[type as EnergyType]?.label ?? type} comprado!`);
    } catch {
      setError("Moedas insuficientes ou energia já possuída.");
    } finally {
      setProcessing(null);
    }
  }

  async function handleBuyShield() {
    setProcessing("shield-buy");
    try {
      const { balance, shieldCount } = await api.purchaseShield();
      setStore((s) =>
        s ? { ...s, balance, shieldCount } : s,
      );
      flash("Escudo comprado!");
    } catch {
      setError("Erro ao comprar escudo.");
    } finally {
      setProcessing(null);
    }
  }

  /* ─── Derived state ───────────────────────────────────────── */

  const equippedItem = store.items.find((it) => it.equipped);

  /* ─── Render ──────────────────────────────────────────────── */

  return (
    <AppShell>
      <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <Header eyebrow="PERSONALIZAÇÃO" title="Loja" />

          {/* ─── Coin Balance ────────────────────────────────── */}
          <div className="mb-8 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-500/20">
              <span className="text-sm font-bold text-yellow-400">$</span>
            </div>
            <span className="font-display text-2xl text-yellow-400">
              {store.balance.toLocaleString("pt-BR")}
            </span>
            <span className="text-sm text-[var(--text-muted)]">moedas</span>
            {feedback && (
              <motion.span
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
              <X
                size={14}
                className="cursor-pointer"
                onClick={() => setError("")}
              />
              {error}
            </motion.div>
          )}

          {/* ─── Section 1: Banners de Perfil ─────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass-card mb-8 p-6 sm:p-8"
          >
            <div className="mb-5 flex items-center gap-2">
              <ImageIcon size={16} className="text-[var(--accent)]" />
              <span className="text-xs uppercase tracking-[0.15em] text-[var(--accent)]">
                Banners de Perfil
              </span>
            </div>

            <input
              ref={bannerFileRef}
              type="file"
              accept="image/*"
              onChange={handleBannerUpload}
              className="sr-only"
            />

            {!store.banner.unlocked ? (
              <>
                <div className="mb-4 aspect-[3/1] w-full overflow-hidden rounded-xl">
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(113,212,255,0.1), rgba(182,156,255,0.1), rgba(255,184,107,0.1))",
                      filter: "blur(8px)",
                    }}
                  >
                    <span className="text-xs text-white/20">???</span>
                  </div>
                </div>
                <p className="mb-4 text-sm text-[var(--text-muted)]">
                  Desbloqueie um banner personalizado para seu perfil
                </p>
                <button
                  onClick={handleUnlockBanner}
                  disabled={
                    processing === "banner-unlock" || store.balance < 1500
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-bg)] py-2.5 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/15 disabled:opacity-40"
                >
                  {processing === "banner-unlock" ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <>
                      <Coins size={13} />
                      Desbloquear por 1500 moedas
                    </>
                  )}
                </button>
              </>
            ) : store.banner.bannerImageUrl ? (
              <>
                <div className="mb-4 aspect-[3/1] w-full overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={store.banner.bannerImageUrl}
                    alt="Banner do perfil"
                    className="h-full w-full object-cover"
                  />
                </div>
                <button
                  onClick={() => bannerFileRef.current?.click()}
                  disabled={processing === "banner-upload"}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-xs text-[var(--text-muted)] transition hover:bg-white/[0.06]"
                >
                  {processing === "banner-upload" ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <>
                      <Upload size={13} />
                      Trocar banner
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <div className="mb-4 aspect-[3/1] w-full overflow-hidden rounded-xl">
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(113,212,255,0.06), rgba(182,156,255,0.06))",
                    }}
                  >
                    <ImageIcon
                      size={24}
                      className="text-white/10"
                    />
                  </div>
                </div>
                <button
                  onClick={() => bannerFileRef.current?.click()}
                  disabled={processing === "banner-upload"}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-xs text-[var(--text-muted)] transition hover:bg-white/[0.06]"
                >
                  {processing === "banner-upload" ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <>
                      <Upload size={13} />
                      Enviar banner
                    </>
                  )}
                </button>
              </>
            )}
          </motion.section>

          {/* ─── Section 2: Molduras de Avatar ─────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="glass-card mb-8 p-6 sm:p-8"
          >
            <div className="mb-5 flex items-center gap-2">
              <Frame size={16} className="text-[var(--purple)]" />
              <span className="text-xs uppercase tracking-[0.15em] text-[var(--purple)]">
                Molduras de Avatar
              </span>
            </div>

            {store.items.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                Nenhuma moldura disponível ainda.
              </p>
            ) : (
              <motion.div
                variants={reduced ? {} : stagger}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-2 gap-3 sm:grid-cols-4"
              >
                {store.items.map((item) => (
                  <StoreItemCard
                    key={item.id}
                    item={item}
                    processing={processing}
                    reduced={!!reduced}
                    onBuy={() => handleBuyDecoration(item.id)}
                    onEquip={() => handleEquipDecoration(item.id)}
                    onUnequip={handleUnequipDecoration}
                    onSelect={() => setSelectedItem(item)}
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
            className="glass-card mb-8 p-6 sm:p-8"
          >
            <div className="mb-5 flex items-center gap-2">
              <Shield size={16} className="text-[var(--green)]" />
              <span className="text-xs uppercase tracking-[0.15em] text-[var(--green)]">
                Escudo de Streak
              </span>
            </div>

            <p className="mb-5 text-sm text-[var(--text-muted)]">
              Proteja sua sequência! Se você esquecer de completar tarefas em um
              dia, o escudo mantém sua streak automaticamente.
            </p>

            <div className="mb-4 flex items-center gap-3">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      background:
                        i < store.shieldCount
                          ? "rgba(74,222,128,0.15)"
                          : "rgba(255,255,255,0.04)",
                      border:
                        i < store.shieldCount
                          ? "1px solid rgba(74,222,128,0.3)"
                          : "1px dashed rgba(255,255,255,0.1)",
                    }}
                  >
                    <Shield
                      size={14}
                      style={{
                        color:
                          i < store.shieldCount
                            ? "var(--green)"
                            : "var(--text-faint)",
                        fill:
                          i < store.shieldCount
                            ? "var(--green)"
                            : "transparent",
                      }}
                    />
                  </div>
                ))}
              </div>
              <span className="text-xs text-[var(--text-muted)]">
                {store.shieldCount} de 3 escudos
              </span>
            </div>

            <p className="mb-4 text-xs text-[var(--text-faint)]">
              200 moedas cada
            </p>

            <button
              onClick={handleBuyShield}
              disabled={
                processing === "shield-buy" ||
                store.balance < 200 ||
                store.shieldCount >= 3
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--green-bg)] py-2.5 text-xs font-semibold text-[var(--green)] transition hover:bg-[var(--green)]/15 disabled:opacity-40"
            >
              {processing === "shield-buy" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <>
                  <Coins size={13} />
                  Comprar escudo
                </>
              )}
            </button>
          </motion.section>

          {/* ─── Section 4: Auras ─────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="glass-card mb-8 p-6 sm:p-8"
          >
            <div className="mb-5 flex items-center gap-2">
              <Sparkles size={16} className="text-[#ffd76b]" />
              <span className="text-xs uppercase tracking-[0.15em] text-[#ffd76b]">
                Auras
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ENERGY_TYPES.map((type) => {
                const info = AURA_DEFS[type];
                const rc = AURA_RARITY_COLORS[info.rarity];
                const isOwned = ownedAuras.includes(type);
                const isProcessing = processing === `aura-${type}`;
                const balance = store.balance;
                return (
                  <div
                    key={type}
                    className="flex flex-col items-center gap-2 rounded-xl border p-4 text-center"
                    style={{
                      borderColor: isOwned ? `${rc.border}33` : "var(--border-subtle)",
                      background: isOwned ? rc.bg : "var(--bg-tertiary)",
                    }}
                  >
                    <div className="relative flex h-16 w-16 items-center justify-center">
                      <Image
                        src={ENERGY_CONFIGS[type].assets.full}
                        alt={info.label}
                        width={60}
                        height={60}
                        style={{ objectFit: "contain", opacity: isOwned ? 1 : 0.35 }}
                        unoptimized
                      />
                      {!isOwned && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Lock size={18} className="text-[var(--text-faint)]" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-medium text-[var(--text-secondary)]">{info.label}</span>
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        background: rc.bg,
                        color: rc.border,
                        border: `1px solid ${rc.border}33`,
                      }}
                    >
                      {AURA_RARITY_LABELS[info.rarity]}
                    </span>

                    {isOwned ? (
                      <span className="flex items-center gap-1 rounded-full bg-[var(--green-bg)] px-2.5 py-1 text-[10px] font-semibold text-[var(--green)]">
                        <Check size={10} />
                        Possuída
                      </span>
                    ) : (
                      <button
                        onClick={() => handleBuyAura(type)}
                        disabled={isProcessing || balance < info.price}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-semibold transition disabled:opacity-40"
                        style={{ background: rc.bg, color: rc.border }}
                      >
                        {isProcessing ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <>
                            <Coins size={11} />
                            {info.price}
                          </>
                        )}
                      </button>
                    )}
                  </div>
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

      {/* ─── Decoration Preview Modal ────────────────────────────── */}
      {selectedItem && user && (
        <DecorationModal
          item={selectedItem}
          user={{
            photoURL: user.photoURL,
            displayName: user.displayName,
          }}
          onClose={() => setSelectedItem(null)}
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
