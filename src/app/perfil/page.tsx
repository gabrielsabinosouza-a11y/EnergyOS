"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { updateProfile } from "firebase/auth";
import { useAuthRedirect } from "@/lib/auth-context";
import { auth } from "@/lib/firebase";
import { streakIconSource } from "@/lib/energy-assets";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/navigation";
import { Modal } from "@/components/modal";
import { api } from "@/lib/api-client";
import type { DashboardSnapshot } from "@/lib/api-client";
import type { AchievementProgress } from "@/types";
import { AvatarWithFrame } from "@/components/avatar";
import { ProfileBanner } from "@/components/profile-banner";
import Image from "next/image";
import {
  Moon,
  Star,
  Lock,
  X,
  Pencil,
  Check,
  Loader2,
  Trophy,
  Timer,
  Target,
  Sparkles,
  Camera,
} from "lucide-react";
import {
  CATEGORY_COLORS,
  AchievementIcon,
  AchievementTile,
  AchievementAddSlot,
} from "@/lib/achievement-ui";
import { MonthlyRecapPremium } from "@/components/dashboard/monthly-recap-premium";
// Keep the old import for fallback if needed
import { MonthlyRecap } from "@/components/dashboard/monthly-recap";
import type { MonthlyRecap as MonthlyRecapType } from "@/types";
import { ENERGYOS_LAUNCH_MONTH } from "@/types";
import { formatStat } from "@/lib/format";

// Lê a imagem escolhida e a comprime para uma thumbnail compacta (data URL),
// evitando depender de serviços externos de upload.
async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const MAX = 400;
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

/* ------------------------------------------------------------------ */
/*  Animation variants                                                */
/* ------------------------------------------------------------------ */

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

const FEATURED_SIZE = 92;
const GRID_SIZE = 104;

/* ------------------------------------------------------------------ */
/*  Achievement detail modal                                          */
/* ------------------------------------------------------------------ */

function AchievementModal({
  achievement,
  onClose,
  isOwn,
  onToggleFeatured,
}: {
  achievement: AchievementProgress;
  onClose: () => void;
  isOwn: boolean;
  onToggleFeatured?: () => void;
}) {
  const colors = CATEGORY_COLORS[achievement.category] ?? { primary: "#71d4ff", bg: "rgba(113,212,255,0.12)", glow: "rgba(113,212,255,0.4)" };
  const isEarned = achievement.unlockedTier > 0;
  const currentIdx = isEarned ? Math.min(achievement.unlockedTier - 1, achievement.thresholds.length - 1) : 0;

  return (
    <Modal onClose={onClose}>
      <div
        className="glass-card relative w-full max-w-sm overflow-hidden p-6"
        style={{ border: `1px solid ${colors.primary}22` }}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)]"
        >
          <X size={16} />
        </button>

        <div className="mb-4 flex flex-col items-center text-center">
          {/* Icon displayed without circular background */}
          <div
            className="relative mb-3 flex items-center justify-center overflow-hidden"
            style={{
              width: 100,
              height: 100,
            }}
          >
            {isEarned ? (
              <AchievementIcon id={achievement.id} tier={achievement.unlockedTier} size={100} color={colors.primary} fill />
            ) : (
              <Lock size={40} className="text-[var(--text-faint)]" />
            )}
          </div>

          <h3 className="font-display text-lg text-[var(--text)]">{achievement.title}</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{achievement.description}</p>
        </div>

        <div className="mb-4">
          <div className="mb-2 text-xs uppercase tracking-widest text-[var(--text-faint)]">Progresso</div>
          {achievement.thresholds.map((threshold, i) => {
            const unlocked = i < achievement.unlockedTier;
            const isCurrent = i === currentIdx;
            return (
              <div
                key={i}
                className={`mb-1.5 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${
                  isCurrent ? "bg-white/[0.06]" : ""
                }`}
              >
                {unlocked ? (
                  <Check size={13} style={{ color: colors.primary }} />
                ) : (
                  <span className="h-[13px] w-[13px] rounded-full border border-white/15" />
                )}
                <span className={unlocked ? "text-[var(--text)]" : "text-[var(--text-faint)]"}>
                  {threshold}
                </span>
                {isCurrent && !unlocked && (
                  <span className="ml-auto text-[10px] text-[var(--text-faint)]">
                    {achievement.currentValue}/{threshold}
                  </span>
                )}
                {isCurrent && unlocked && achievement.currentValue >= threshold && (
                  <span className="ml-auto text-[10px]" style={{ color: colors.primary }}>
                    {achievement.currentValue}/{threshold}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {isEarned && achievement.unlockedAt && (
          <p className="mb-3 text-center text-xs text-[var(--text-faint)]">
            Desbloqueado em{" "}
            {new Date(achievement.unlockedAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}

        {isOwn && isEarned && onToggleFeatured && (
          <button
            onClick={onToggleFeatured}
            className="w-full rounded-xl py-2.5 text-xs font-semibold transition"
            style={{
              background: achievement.isFeatured ? "rgba(248,113,113,0.12)" : colors.bg,
              color: achievement.isFeatured ? "var(--red)" : colors.primary,
            }}
          >
            {achievement.isFeatured ? "Remover dos destaques" : "Adicionar aos destaques"}
          </button>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function PerfilPage() {
  const { user, loading } = useAuthRedirect({ ifGuest: "/" });
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [equippedDecorationId, setEquippedDecorationId] = useState<string | undefined>();
  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(null);
  const [hasCustomBanner, setHasCustomBanner] = useState(false);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null);
  const [achievements, setAchievements] = useState<AchievementProgress[]>([]);
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementProgress | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [recaps, setRecaps] = useState<MonthlyRecapType[]>([]);
  const [generatingRecap, setGeneratingRecap] = useState(false);
  const [recapError, setRecapError] = useState("");
  const [envStatus, setEnvStatus] = useState<{ groups: { label: string; vars: { key: string; set: boolean; value: string | null }[] }[]; allSet: boolean } | null>(null);
  const [showEnv, setShowEnv] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([
      api.getDashboard().catch(() => null),
      api.getAchievements().catch(() => null),
      api.getRecaps().catch(() => null),
      api.getProfile().catch(() => null),
      api.getEnvStatus().catch(() => null),
    ]).then(([dash, ach, recapResult, profileResult, env]) => {
      if (!active) return;
      if (dash) setDashboard(dash);
      if (ach) setAchievements(ach.achievements);
      if (recapResult?.recaps) setRecaps(recapResult.recaps);
      if (profileResult?.user?.photoUrl) setPhotoUrl(profileResult.user.photoUrl);
      if (profileResult?.user?.equippedDecorationId) setEquippedDecorationId(profileResult.user.equippedDecorationId);
      if (profileResult?.user?.bannerImageUrl) setBannerImageUrl(profileResult.user.bannerImageUrl);
      if (profileResult?.user?.hasCustomBanner) setHasCustomBanner(profileResult.user.hasCustomBanner);
      if (env) setEnvStatus(env);
    });
    return () => { active = false; };
  }, [user?.uid]);

  if (loading || !user) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
        </div>
      </AppShell>
    );
  }

  const displayName = user.displayName ?? "Usuário";
  const avatarSrc = photoUrl ?? user.photoURL ?? undefined;
  const createdAt = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : "—";
  const username = (user as { username?: string }).username;

  const streak = dashboard?.streak?.currentStreak ?? 0;
  const longestStreak = dashboard?.streak?.longestStreak ?? streak;
  // lifetime focus in minutes (xp_olympian achievement tracks lifetimeFocus)
  const lifetimeFocus = achievements.find((a) => a.id === "xp_olympian")?.currentValue ?? 0;
  const lifetimeFocusH = Math.floor(lifetimeFocus / 60);

  const featured = achievements.filter((a) => a.isFeatured).sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0));
  const featuredIds = new Set(featured.map((f) => f.id));
  const unlocked = achievements.filter((a) => a.unlockedTier > 0);
  const locked = achievements.filter((a) => a.unlockedTier === 0);
  const sorted = [...unlocked, ...locked];

  function startEdit() {
    setName(displayName);
    setEditingName(true);
  }

  async function saveName() {
    if (!name.trim() || name.trim() === displayName) { setEditingName(false); return; }
    if (!auth?.currentUser) return;
    setSaving(true);
    try {
      await updateProfile(auth.currentUser, { displayName: name.trim() });
      await api.updateDisplayName(name.trim());
      setSaved(true);
      setEditingName(false);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setPhotoError("Não foi possível atualizar o nome.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 7 * 1024 * 1024) {
      setPhotoError("Escolha uma imagem de até 7 MB.");
      return;
    }
    setPhotoSaving(true);
    setPhotoError("");
    try {
      const photoUrl = await fileToDataUrl(file);
      if (auth?.currentUser) {
        try { await updateProfile(auth.currentUser, { photoURL: photoUrl }); } catch { /* best-effort */ }
      }
      await api.updatePhotoUrl(photoUrl);
      setPhotoUrl(photoUrl);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setPhotoError("Não foi possível enviar a foto.");
    } finally {
      setPhotoSaving(false);
      event.target.value = "";
    }
  }

  async function uploadBanner(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setBannerError("Escolha uma imagem de até 5 MB.");
      return;
    }
    setBannerSaving(true);
    setBannerError("");
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
      setBannerImageUrl(data.secure_url);
      setHasCustomBanner(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setBannerError("Não foi possível enviar o banner.");
    } finally {
      setBannerSaving(false);
      event.target.value = "";
    }
  }

  async function handleToggleFeatured(achievementId: string) {
    try {
      const result = await api.toggleFeaturedAchievement(achievementId);
      setAchievements((prev) =>
        prev.map((a) => {
          if (a.id === achievementId) {
            return { ...a, isFeatured: result.isFeatured, featuredOrder: result.featuredOrder };
          }
          return a;
        }),
      );
      if (selectedAchievement?.id === achievementId) {
        setSelectedAchievement((prev) =>
          prev ? { ...prev, isFeatured: result.isFeatured, featuredOrder: result.featuredOrder } : prev,
        );
      }
    } catch { /* silent */ }
  }

  async function handleGenerateRecap() {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const launch = new Date(`${ENERGYOS_LAUNCH_MONTH}T00:00:00`);
    const target = prevMonth < launch
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : prevMonth;
    const month = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-01`;
    setGeneratingRecap(true);
    setRecapError("");
    try {
      const result = await api.generateRecap(month);
      if (result?.recap) {
        setRecaps((prev) => {
          const exists = prev.some((r) => r.recapMonth === result.recap.recapMonth);
          if (exists) return prev.map((r) => r.recapMonth === result.recap.recapMonth ? result.recap : r);
          return [result.recap, ...prev];
        });
      }
    } catch {
      setRecapError("Não foi possível gerar o recap.");
    } finally {
      setGeneratingRecap(false);
    }
  }

  function handlePickerSelect(id: string) {
    if (!featuredIds.has(id)) {
      handleToggleFeatured(id);
    }
    setShowPicker(false);
  }

  const metrics = [
    { icon: Moon, color: "#71d4ff", label: "Sono", kind: "sleep" as const, unit: "h" },
    { icon: Timer, color: "#b69cff", label: "Estudo", kind: "study" as const, unit: "min" },
    { icon: Target, color: "#ffb86b", label: "Treino", kind: "training" as const, unit: "min" },
  ];

  const heroStats = [
    {
      label: "Streak atual",
      color: "var(--orange)",
      value: `${streak} dias`,
      icon: <Image src={streakIconSource(streak)} alt="streak" width={16} height={16} style={{ objectFit: "contain" }} unoptimized />,
      glow: "0 0 22px -8px rgba(255,184,107,0.16)",
    },
    {
      label: "Maior sequência",
      color: "var(--orange)",
      value: `${longestStreak} dias`,
      icon: <Image src={streakIconSource(longestStreak)} alt="streak" width={16} height={16} style={{ objectFit: "contain" }} unoptimized />,
      glow: "0 0 22px -8px rgba(255,184,107,0.12)",
    },
    {
      label: "Conquistas",
      color: "var(--accent)",
      value: `${unlocked.length}/${achievements.length}`,
      icon: <Trophy size={16} />,
      glow: "0 0 22px -8px rgba(113,212,255,0.16)",
    },
    {
      label: "Foco na vida",
      color: "var(--purple)",
      value: `${lifetimeFocusH}h`,
      icon: <Timer size={16} />,
      glow: "0 0 22px -8px rgba(182,156,255,0.16)",
    },
  ];

  return (
    <AppShell>
      <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <Header eyebrow="CONTA" title="Meu perfil" />

          {/* ─── Env / config status (diagnostic) ─────────────── */}
          {envStatus && (
            <button
              onClick={() => setShowEnv((v) => !v)}
              className="mb-6 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-4 py-3 text-left text-sm transition-colors hover:border-[var(--accent-border)]"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--text)]">Status do ambiente</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    envStatus.allSet
                      ? "bg-green-500/15 text-green-400"
                      : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  {envStatus.allSet ? "Todas configuradas" : "Faltam variáveis"}
                </span>
              </div>
              {showEnv && (
                <div className="mt-3 space-y-3 border-t border-[var(--border-subtle)] pt-3">
                  {envStatus.groups.map((group) => (
                    <div key={group.label}>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                        {group.label}
                      </p>
                      <ul className="space-y-0.5">
                        {group.vars.map((v) => (
                          <li key={v.key} className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate font-mono text-[var(--text-muted)]">{v.key}</span>
                            <span className={v.set ? "text-green-400" : "text-red-400"}>
                              {v.set ? `✓ ${v.value ?? ""}` : "não definida"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <p className="text-[10px] text-[var(--text-faint)]">Valores mascarados por segurança.</p>
                </div>
              )}
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={uploadPhoto}
            className="sr-only"
            disabled={photoSaving}
          />

          <input
            ref={bannerFileRef}
            type="file"
            accept="image/*"
            onChange={uploadBanner}
            className="sr-only"
            disabled={bannerSaving}
          />

          {/* ─── Hero header ───────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={`glass-card relative mb-6 overflow-hidden`}
          >
            {/* subtle ambient tint matching equipped frame rarity */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background: "radial-gradient(ellipse at 30% -10%, rgba(182,156,255,0.10), transparent 55%), radial-gradient(ellipse at 100% 0%, rgba(255,184,107,0.08), transparent 50%)",
              }}
            />

            {hasCustomBanner && (
              <ProfileBanner imageUrl={bannerImageUrl} alt="Banner do perfil">
                <button
                  type="button"
                  onClick={() => bannerFileRef.current?.click()}
                  disabled={bannerSaving}
                  className="pointer-events-auto absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1.5 text-[11px] font-medium text-white backdrop-blur transition hover:bg-black/75 disabled:opacity-60"
                >
                  {bannerSaving ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                  {bannerSaving ? "Enviando..." : bannerImageUrl ? "Trocar banner" : "Enviar banner"}
                </button>
                {bannerError && (
                  <p className="pointer-events-auto absolute left-3 top-3 z-20 max-w-[70%] truncate rounded-lg bg-black/55 px-2.5 py-1.5 text-[11px] text-[var(--red)] backdrop-blur">
                    {bannerError}
                  </p>
                )}
              </ProfileBanner>
            )}

            <div className={`relative z-[1] p-6 sm:p-8 ${hasCustomBanner ? "pt-0" : ""}`}>
              <div className={`flex flex-col items-center gap-5 text-center ${hasCustomBanner ? "-mt-10" : ""} sm:flex-row sm:text-left`}>
                <div className="relative z-10 shrink-0">
                  <AvatarWithFrame
                    photoUrl={avatarSrc}
                    name={displayName}
                    size={92}
                    equippedDecorationId={equippedDecorationId}
                  />
                  {/* camera overlay */}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={photoSaving}
                    aria-label="Trocar foto"
                    className="group absolute inset-0 z-20 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity hover:opacity-100 disabled:opacity-0"
                  >
                    {photoSaving
                      ? <Loader2 size={22} className="animate-spin text-white" />
                      : <Camera size={22} className="text-white" />}
                  </button>
                  <span className="pointer-events-none absolute -bottom-1 -right-1 z-30 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--bg)] bg-[var(--accent-bg)] text-[var(--accent)]">
                    {photoSaving ? <Loader2 size={11} className="animate-spin" /> : <Pencil size={11} />}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  {editingName ? (
                    <div className="flex items-center justify-center gap-2 sm:justify-start">
                      <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveName();
                          if (e.key === "Escape") setEditingName(false);
                        }}
                        className="auth-input !py-1.5 !text-base flex-1"
                      />
                      <button onClick={saveName} disabled={saving} className="icon-button small">
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      </button>
                      <button onClick={() => setEditingName(false)} className="icon-button small">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 sm:justify-start">
                      <h2 className="font-display text-2xl tracking-[-0.03em]">{displayName}</h2>
                      {dashboard?.user?.role === 'admin' && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--accent)] text-[var(--bg-primary)] rounded-full">
                          Admin
                        </span>
                      )}
                      <button onClick={startEdit} className="icon-button small !h-7 !w-7">
                        <Pencil size={12} />
                      </button>
                    </div>
                  )}
                  {username && (
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">@{username}</p>
                  )}
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">Membro desde {createdAt}</p>
                  {saved && <p className="mt-1 text-xs text-[var(--accent)]">Salvo!</p>}
                  {photoError && <p className="mt-1 text-xs text-[var(--red)]">{photoError}</p>}
                </div>
              </div>

              {/* ─── Stats strip ──────────────────────────────── */}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {heroStats.map((s) => (
                  <motion.div
                    key={s.label}
                    whileHover={reduced ? undefined : { y: -2 }}
                    transition={{ duration: 0.15 }}
                    className="metric-card"
                    style={{ boxShadow: s.glow }}
                  >
                    <div className="metric-caption mb-1" style={{ color: s.color }}>{s.label}</div>
                    <div className="flex items-center gap-1.5" style={{ color: s.color }}>
                      {s.icon}
                      <span className="font-display text-base">{s.value}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ─── Featured Achievements (Destaques) ─────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="glass-card relative mb-6 overflow-hidden p-6 sm:p-8"
          >
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 90% 0%, rgba(255,215,107,0.06), transparent 55%)" }} />
            <div className="relative mb-5 flex items-center gap-2">
              <Star size={16} className="text-[var(--orange)]" />
              <span className="text-xs uppercase tracking-[0.15em] text-[var(--orange)]">Destaques</span>
            </div>

            <div className="relative flex flex-wrap justify-center gap-4 sm:justify-start">
              {[0, 1, 2, 3].map((slot) => {
                const ach = featured[slot];
                if (!ach) {
                  return (
                    <div key={slot} className="flex shrink-0 flex-col items-center gap-2" style={{ width: FEATURED_SIZE }}>
                      <AchievementAddSlot
                        size={FEATURED_SIZE}
                        onClick={() => setShowPicker(true)}
                        reduced={!!reduced}
                      />
                    </div>
                  );
                }
                return (
                  <div key={slot} className="flex shrink-0 flex-col items-center gap-2" style={{ width: FEATURED_SIZE }}>
                    <AchievementTile
                      achievement={ach}
                      size={FEATURED_SIZE}
                      onClick={() => setSelectedAchievement(ach)}
                      showRemove
                      onRemove={(e) => {
                        e.stopPropagation();
                        handleToggleFeatured(ach.id);
                      }}
                      reduced={!!reduced}
                      feature
                      showProgress={false}
                    />
                    <span className="max-w-full truncate text-center text-[10px] text-[var(--text-muted)]">
                      {ach.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.section>

          {/* ─── Full Achievements Grid ─────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="glass-card relative mb-6 overflow-hidden p-6 sm:p-8"
          >
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 10% 100%, rgba(113,212,255,0.05), transparent 55%)" }} />
            <div className="relative mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-[var(--accent)]" />
                <span className="text-xs uppercase tracking-[0.15em] text-[var(--accent)]">Conquistas</span>
              </div>
              <span className="text-xs text-[var(--text-faint)]">
                {unlocked.length} de {achievements.length} desbloqueadas
              </span>
            </div>

            {achievements.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                Nenhuma conquista disponível ainda.
              </p>
            ) : (
              <motion.div
                variants={reduced ? {} : stagger}
                initial="hidden"
                animate="visible"
                className="relative grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4"
              >
                {sorted.map((ach) => (
                  <motion.div key={ach.id} variants={reduced ? {} : fadeUp} className="flex flex-col items-center justify-between gap-2">
                    <AchievementTile
                      achievement={ach}
                      size={GRID_SIZE}
                      onClick={() => setSelectedAchievement(ach)}
                      reduced={!!reduced}
                      feature={ach.isFeatured}
                    />
                    <span className="line-clamp-2 text-center text-[10px] leading-tight text-[var(--text-secondary)]">
                      {ach.title}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.section>

          {/* ─── Monthly Recaps ─────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="glass-card relative mb-6 overflow-hidden p-6 sm:p-8"
          >
            <div className="relative mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[var(--purple)]" />
                <span className="text-xs uppercase tracking-[0.15em] text-[var(--purple)]">Recap mensal</span>
              </div>
              <button
                onClick={handleGenerateRecap}
                disabled={generatingRecap}
                className="primary-button !text-xs !py-1.5 !px-3"
              >
                {generatingRecap ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {generatingRecap ? "Gerando..." : "Gerar recap"}
              </button>
            </div>
            {recapError && (
              <p className="relative mb-4 text-xs text-[var(--red)]">{recapError}</p>
            )}
            {recaps.length === 0 ? (
              <p className="relative py-6 text-center text-sm text-[var(--text-muted)]">
                Nenhum recap disponível. Gere o recap do mês anterior!
              </p>
            ) : (
              <div className="relative space-y-3">
                {recaps.map((recap) => (
                  <MonthlyRecapPremium
                    key={recap.id}
                    recap={{
                      id: recap.id,
                      recapMonth: recap.recapMonth,
                      totalFocusMinutes: recap.totalFocusMinutes,
                      longestStreak: recap.longestStreak,
                      leagueTier: recap.leagueTier,
                      leaguePromoted: recap.leaguePromoted,
                      productivityTag: recap.productivityTag,
                      gardenCount: recap.gardenCount,
                      hasBeenShared: recap.hasBeenShared,
                    }}
                    userName={displayName}
                    userPhotoUrl={user.photoURL ?? undefined}
                    onCoinsAwarded={(_amount, _newBalance) => {
                      // coin balance lives in dashboard page state
                    }}
                  />
                ))}
              </div>
            )}
          </motion.section>

          {/* ─── Private Section ────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="glass-card p-6 sm:p-8"
          >
            <div className="mb-4 flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.15em] text-[var(--purple)]">Dados pessoais</span>
            </div>

            <div className="mb-6">
              <span className="eyebrow muted mb-4 block">MÉDIAS DA SEMANA</span>
              <div className="grid gap-3 sm:grid-cols-3">
                {metrics.map(({ icon: Icon, color, label, kind, unit }) => {
                  const metric = dashboard?.metrics.find((m) => m.kind === kind);
                  const displayValue = metric ? formatStat(metric.value, unit) : "Sem dados";
                  return (
                    <div key={label} className="metric-card flex items-center gap-3">
                      <div className="metric-icon" style={{ color }}><Icon size={15} /></div>
                      <div>
                        <div className="metric-caption">{label}</div>
                        <div className="font-display text-base text-[var(--text-secondary)]">
                          {displayValue}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-[var(--text-faint)]">
                Médias calculadas conforme você registrar check-ins diários.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <motion.div
                whileHover={reduced ? undefined : { y: -2 }}
                transition={{ duration: 0.15 }}
                className="metric-card"
                style={{ boxShadow: "0 0 20px -8px rgba(182,156,255,0.12)" }}
              >
                <div className="metric-caption mb-1" style={{ color: "var(--purple)" }}>Provedor</div>
                <div className="font-display text-sm text-[var(--text-secondary)]">
                  {user.providerData[0]?.providerId === "google.com" ? "Google" : "E-mail"}
                </div>
              </motion.div>

              <motion.div
                whileHover={reduced ? undefined : { y: -2 }}
                transition={{ duration: 0.15 }}
                className="metric-card"
                style={{ boxShadow: "0 0 20px -8px rgba(113,212,255,0.12)" }}
              >
                <div className="metric-caption mb-1" style={{ color: "var(--accent)" }}>Membro desde</div>
                <div className="font-display text-sm text-[var(--text-secondary)]">{createdAt}</div>
              </motion.div>
            </div>
          </motion.section>
        </div>
      </main>

      {/* ─── Achievement Detail Modal ────────────────────────────── */}
      {selectedAchievement && (
        <AchievementModal
          achievement={selectedAchievement}
          onClose={() => setSelectedAchievement(null)}
          isOwn
          onToggleFeatured={() => handleToggleFeatured(selectedAchievement.id)}
        />
      )}

      {/* ─── Picker Modal ────────────────────────────────────────── */}
      {showPicker && (
        <Modal onClose={() => setShowPicker(false)}>
          <div className="glass-card w-full max-w-sm overflow-hidden p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg">Escolha uma conquista</h3>
                <button
                  onClick={() => setShowPicker(false)}
                  className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)]"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {unlocked.map((ach) => {
                  const alreadyFeatured = featuredIds.has(ach.id);
                  const colors = CATEGORY_COLORS[ach.category] ?? { primary: "#71d4ff", bg: "rgba(113,212,255,0.12)" };
                  return (
                    <button
                      key={ach.id}
                      onClick={() => handlePickerSelect(ach.id)}
                      disabled={alreadyFeatured}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                        alreadyFeatured
                          ? "opacity-40"
                          : "hover:bg-white/[0.05]"
                      }`}
                    >
                      <div
                        className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full"
                        style={{
                          background: `radial-gradient(circle at 30% 30%, ${colors.primary}, ${colors.bg})`,
                        }}
                      >
                        <AchievementIcon id={ach.id} tier={ach.unlockedTier} size={40} color="#000" fill />
                      </div>
                      <span className="text-[var(--text)]">{ach.title}</span>
                      {alreadyFeatured && <span className="ml-auto text-[10px] text-[var(--text-faint)]">Já destacada</span>}
                    </button>
                  );
                })}
                {unlocked.length === 0 && (
                  <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                    Nenhuma conquista desbloqueada ainda.
                  </p>
                )}
              </div>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
