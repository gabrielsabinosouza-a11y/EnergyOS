"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/navigation";
import { Modal } from "@/components/modal";
import { AvatarWithFrame } from "@/components/avatar";
import { ProfileBanner } from "@/components/profile-banner";
import { useAuthRedirect } from "@/lib/auth-context";
import { streakIconSource } from "@/lib/energy-assets";
import { api } from "@/lib/api-client";
import type { PublicProfile, AchievementProgress } from "@/types";
import Image from "next/image";
import {
  Lock,
  X,
  Trophy,
  Loader2,
  ArrowLeft,
  UserPlus,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { CATEGORY_COLORS, AchievementIcon, AchievementTile } from "@/lib/achievement-ui";

/* ------------------------------------------------------------------ */
/*  Animation variants                                                */
/* ------------------------------------------------------------------ */

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

const FEATURED_SIZE = 96;
const GRID_SIZE = 76;

/* ------------------------------------------------------------------ */
/*  Achievement Modal (read-only)                                     */
/* ------------------------------------------------------------------ */

function AchievementModal({
  achievement,
  onClose,
}: {
  achievement: AchievementProgress;
  onClose: () => void;
}) {
  const colors = CATEGORY_COLORS[achievement.category] ?? { primary: "#71d4ff", bg: "rgba(113,212,255,0.12)", glow: "rgba(113,212,255,0.4)" };
  const isEarned = achievement.unlockedTier > 0;
  // Active tier is the first not-yet-completed one (where live progress shows);
  // when the achievement is maxed out, fall back to the last tier.
  const activeIdx = Math.min(achievement.unlockedTier, achievement.thresholds.length - 1);

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
            const isLive = i === achievement.unlockedTier;
            const isCurrent = i === activeIdx;
            return (
              <div
                key={i}
                className={`mb-1.5 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${isCurrent ? "bg-white/[0.06]" : ""}`}
              >
                {unlocked ? (
                  <span style={{ color: colors.primary }}>&#10003;</span>
                ) : (
                  <span className="h-[13px] w-[13px] rounded-full border border-white/15" />
                )}
                <span className={unlocked ? "text-[var(--text)]" : "text-[var(--text-faint)]"}>
                  {threshold}
                </span>
                {unlocked && (
                  <span className="ml-auto text-[10px]" style={{ color: colors.primary }}>
                    {threshold}/{threshold}
                  </span>
                )}
                {isLive && (
                  <span className="ml-auto text-[10px]" style={{ color: "var(--text-faint)" }}>
                    {achievement.currentValue}/{threshold}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {isEarned && achievement.unlockedAt && (
          <p className="text-center text-xs text-[var(--text-faint)]">
            Desbloqueado em{" "}
            {new Date(achievement.unlockedAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function FriendProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuthRedirect({ ifGuest: "/" });
  const reduced = useReducedMotion();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementProgress | null>(null);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    if (authLoading || !user || !id) return;
    let cancelled = false;
    api
      .getPublicProfile(id)
      .then(({ profile: p }) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setError("Perfil não encontrado.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [authLoading, user?.uid, id]);

  async function handleAddFriend() {
    if (!id) return;
    setRequestSent(true);
    try {
      await api.sendFriendRequest(id);
    } catch {
      setRequestSent(false);
    }
  }

  if (authLoading || !user) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
        </div>
      </AppShell>
    );
  }

  if (error || !profile) {
    return (
      <AppShell>
        <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-2xl">
            <Header eyebrow="PERFIL" title="Erro" />
            <div className="glass-card p-8 text-center">
              <p className="mb-4 text-sm text-[var(--text-muted)]">{error ?? "Perfil não encontrado."}</p>
              <Link href="/amigos" className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs">
                <ArrowLeft size={14} />
                Voltar
              </Link>
            </div>
          </div>
        </main>
      </AppShell>
    );
  }

  const displayName = profile.displayName;
  const createdAt = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : "—";

  const featured = profile.featuredAchievements ?? [];
  const sorted = [...(profile.achievements ?? [])];
  const unlocked = sorted.filter((a) => a.unlockedTier > 0);
  const locked = sorted.filter((a) => a.unlockedTier === 0);
  const allSorted = [...unlocked, ...locked];

  const streak = profile.currentStreak;
  const longestStreak = profile.longestStreak;

  const canView = profile.isFriend || profile.isOwner;

  const heroStats = [
    {
      label: "Streak atual",
      color: "var(--orange)",
      value: `${streak} dias`,
      icon: <Image src={streakIconSource(streak)} alt="streak" width={16} height={16} style={{ objectFit: "contain" }} unoptimized />,
    },
    {
      label: "Maior sequência",
      color: "var(--orange)",
      value: `${longestStreak} dias`,
      icon: <Image src={streakIconSource(longestStreak)} alt="streak" width={16} height={16} style={{ objectFit: "contain" }} unoptimized />,
    },
    {
      label: "Foco semanal",
      color: "var(--purple)",
      value: `${Math.floor(profile.weeklyFocusMinutes / 60)}h${profile.weeklyFocusMinutes % 60 > 0 ? ` ${profile.weeklyFocusMinutes % 60}min` : ""}`,
      icon: <Trophy size={16} />,
    },
  ];

  return (
    <AppShell>
      <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl">
          {/* ─── Action bar ──────────────────────────────────────── */}
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-[var(--text-muted)] transition hover:bg-white/[0.1] hover:text-[var(--text)]"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex-1">
              <Header eyebrow="PERFIL" title={displayName} />
            </div>
          </div>

          {!profile.isOwner && (
            <div className="mb-6 flex gap-3">
              {profile.isFriend ? (
                <Link
                  href="/amigos"
                  className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs"
                >
                  <MessageCircle size={14} />
                  Enviar mensagem
                </Link>
              ) : (
                <button
                  onClick={handleAddFriend}
                  disabled={requestSent}
                  className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-50"
                >
                  <UserPlus size={14} />
                  {requestSent ? "Pedido enviado" : "Adicionar amigo"}
                </button>
              )}
            </div>
          )}

          {/* ─── Hero header ─────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={`glass-card relative mb-6 overflow-hidden`}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background: "radial-gradient(ellipse at 30% -10%, rgba(182,156,255,0.10), transparent 55%), radial-gradient(ellipse at 100% 0%, rgba(255,184,107,0.08), transparent 50%)",
              }}
            />
            {profile.hasCustomBanner && (
              <ProfileBanner
                imageUrl={profile.bannerImageUrl}
                alt={`Banner de ${displayName}`}
              />
            )}
            <div className={`relative z-[1] p-6 sm:p-8 ${profile.hasCustomBanner ? "pt-0" : ""}`}>
              <div className={`flex items-center gap-5 ${profile.hasCustomBanner ? "-mt-10" : ""} mb-6`}>
                <div className="relative z-10 shrink-0">
                  <AvatarWithFrame
                    photoUrl={profile.photoUrl}
                    name={displayName}
                    size={92}
                    equippedDecorationId={profile.equippedDecorationId}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-2xl tracking-[-0.03em]">{displayName}</h2>
                    {profile.role === "admin" && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--accent)] text-[var(--bg-primary)] rounded-full">
                        Admin
                      </span>
                    )}
                  </div>
                  {profile.username && <p className="mt-0.5 text-xs text-[var(--text-muted)]">@{profile.username}</p>}
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">Membro desde {createdAt}</p>
                </div>
              </div>

              {/* ─── Stats strip ─────────────────────────────── */}
              <div className="grid grid-cols-3 gap-3">
                {heroStats.map((s) => (
                  <motion.div
                    key={s.label}
                    whileHover={reduced ? undefined : { y: -2 }}
                    transition={{ duration: 0.15 }}
                    className="metric-card"
                    style={{ boxShadow: "0 0 20px -8px rgba(255,184,107,0.12)" }}
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

          {/* ─── Featured Achievements ──────────────────────────── */}
          {featured.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="glass-card relative mb-6 overflow-hidden p-6 sm:p-8"
            >
              <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 90% 0%, rgba(255,215,107,0.06), transparent 55%)" }} />
              <div className="relative mb-5 flex items-center gap-2">
                <Trophy size={16} className="text-[var(--orange)]" />
                <span className="text-xs uppercase tracking-[0.15em] text-[var(--orange)]">Destaques</span>
              </div>

              <div className="relative flex gap-4 overflow-x-auto pb-2">
                {featured.map((ach) => (
                  <div key={ach.id} className="flex shrink-0 flex-col items-center gap-2" style={{ width: FEATURED_SIZE }}>
                    <AchievementTile
                      achievement={ach}
                      size={FEATURED_SIZE}
                      onClick={() => setSelectedAchievement(ach)}
                      reduced={!!reduced}
                      feature
                      showProgress={false}
                    />
                    <span className="max-w-full truncate text-center text-[10px] text-[var(--text-muted)]">
                      {ach.title}
                    </span>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* ─── Achievements Grid ─────────────────────────────── */}
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
              {canView && (
                <span className="text-xs text-[var(--text-faint)]">
                  {unlocked.length} de {allSorted.length} desbloqueadas
                </span>
              )}
            </div>

            {!canView ? (
              <p className="relative py-6 text-center text-sm text-[var(--text-muted)]">
                Adicione como amigo para ver as conquistas.
              </p>
            ) : allSorted.length === 0 ? (
              <p className="relative py-6 text-center text-sm text-[var(--text-muted)]">
                Nenhuma conquista disponível.
              </p>
            ) : (
              <motion.div
                variants={reduced ? {} : stagger}
                initial="hidden"
                animate="visible"
                className="relative grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5"
              >
                {allSorted.map((ach) => (
                  <motion.div
                    key={ach.id}
                    variants={reduced ? {} : fadeUp}
                    className="flex flex-col items-center justify-between gap-2"
                  >
                    <AchievementTile
                      achievement={ach}
                      size={GRID_SIZE}
                      onClick={() => setSelectedAchievement(ach)}
                      reduced={!!reduced}
                      feature={ach.isFeatured}
                      showProgress={false}
                    />
                    <span className="line-clamp-2 text-center text-[10px] leading-tight text-[var(--text-secondary)]">
                      {ach.title}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.section>
        </div>
      </main>

      {/* ─── Achievement Detail Modal ────────────────────────────── */}
      {selectedAchievement && (
        <AchievementModal
          key={selectedAchievement.id}
          achievement={selectedAchievement}
          onClose={() => setSelectedAchievement(null)}
        />
      )}
    </AppShell>
  );
}
