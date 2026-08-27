"use client";

import { useEffect, useState } from "react";
import React from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/navigation";
import { Modal } from "@/components/modal";
import { useAuthRedirect } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import type { PublicProfile, AchievementProgress } from "@/types";
import Image from "next/image";
import {
  Zap,
  Sun,
  Moon,
  Calendar,
  Star,
  Users,
  Gem,
  Lock,
  X,
  Trophy,
  Loader2,
  ArrowLeft,
  UserPlus,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Constants (shared with own profile)                               */
/* ------------------------------------------------------------------ */

const CATEGORY_COLORS: Record<string, { primary: string; bg: string; glow: string }> = {
  streak: { primary: "#ff8c42", bg: "rgba(255,140,66,0.12)", glow: "rgba(255,140,66,0.4)" },
  focus: { primary: "#b69cff", bg: "rgba(182,156,255,0.12)", glow: "rgba(182,156,255,0.4)" },
  checkin: { primary: "#4ade80", bg: "rgba(74,222,128,0.12)", glow: "rgba(74,222,128,0.4)" },
  sleep: { primary: "#71d4ff", bg: "rgba(113,212,255,0.12)", glow: "rgba(113,212,255,0.4)" },
  social: { primary: "#f472b6", bg: "rgba(244,114,182,0.12)", glow: "rgba(244,114,182,0.4)" },
  league: { primary: "#ffd76b", bg: "rgba(255,215,107,0.12)", glow: "rgba(255,215,107,0.4)" },
};

const FlameImg = ({ size = 14, ...props }: { size?: number } & Record<string, unknown>) => (
  <Image src="/energies/flame/flame_start.png" alt="streak" width={size} height={size} style={{ objectFit: "contain" }} unoptimized {...props} />
);

const ACHIEVEMENT_ICONS: Record<string, React.ElementType> = {
  streak_master: FlameImg,
  deep_focus: Zap,
  early_riser: Sun,
  sleep_champion: Moon,
  consistency_king: Calendar,
  xp_olympian: Star,
  social_spark: Users,
  rarest_aura: Gem,
};

const DEFAULT_ICON = Trophy;

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
  const Icon = ACHIEVEMENT_ICONS[achievement.id] ?? DEFAULT_ICON;
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
          <div
            className="mb-3 flex items-center justify-center rounded-full"
            style={{
              width: 100,
              height: 100,
              background: isEarned
                ? `radial-gradient(circle at 30% 30%, ${colors.primary}, ${colors.bg})`
                : "rgba(255,255,255,0.04)",
              boxShadow: isEarned ? `0 0 30px ${colors.glow}` : "none",
            }}
          >
            {isEarned ? (
              <Icon size={40} style={{ color: "#000" }} />
            ) : (
              <Lock size={36} className="text-[var(--text-faint)]" />
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
                {isCurrent && (
                  <span className="ml-auto text-[10px]" style={{ color: unlocked ? colors.primary : "var(--text-faint)" }}>
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
  const initials = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
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
  const glowAlpha = Math.min(0.15 + streak * 0.01, 0.45).toFixed(2);
  const avatarGlow = streak > 0
    ? `0 0 0 3px rgba(255,184,107,${glowAlpha}), 0 0 28px rgba(255,184,107,${glowAlpha})`
    : undefined;

  return (
    <AppShell>
      <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-2xl">
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

          {/* ─── Avatar + Name ─────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass-card mb-6 p-6 sm:p-8"
          >
            <div className="flex items-center gap-5 mb-6">
              <div className="avatar" style={{ width: 80, height: 80, fontSize: 28, boxShadow: avatarGlow }}>
                {profile.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.photoUrl} alt={displayName} className="h-full w-full rounded-full object-cover" />
                ) : (
                  initials
                )}
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

            {/* ─── Streak Stats Row ─────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              <motion.div
                whileHover={reduced ? undefined : { y: -2 }}
                transition={{ duration: 0.15 }}
                className="metric-card"
                style={{ boxShadow: "0 0 20px -8px rgba(255,184,107,0.12)" }}
              >
                <div className="metric-caption mb-1" style={{ color: "var(--orange)" }}>Streak atual</div>
                <div className="flex items-center gap-1.5 text-[var(--orange)]">
                  <Image src="/energies/flame/flame_start.png" alt="streak" width={14} height={14} style={{ objectFit: "contain" }} unoptimized />
                  <span className="font-display text-base">{streak} dias</span>
                </div>
              </motion.div>

              <motion.div
                whileHover={reduced ? undefined : { y: -2 }}
                transition={{ duration: 0.15 }}
                className="metric-card"
                style={{ boxShadow: "0 0 20px -8px rgba(255,184,107,0.08)" }}
              >
                <div className="metric-caption mb-1" style={{ color: "var(--orange)" }}>Maior sequência</div>
                <div className="flex items-center gap-1.5 text-[var(--orange)]">
                  <Image src="/energies/flame/flame_start.png" alt="streak" width={14} height={14} style={{ objectFit: "contain" }} unoptimized />
                  <span className="font-display text-base">{longestStreak} dias</span>
                </div>
              </motion.div>

              <motion.div
                whileHover={reduced ? undefined : { y: -2 }}
                transition={{ duration: 0.15 }}
                className="metric-card"
                style={{ boxShadow: "0 0 20px -8px rgba(182,156,255,0.12)" }}
              >
                <div className="metric-caption mb-1" style={{ color: "var(--purple)" }}>Foco semanal</div>
                <div className="flex items-center gap-1.5 text-[var(--purple)]">
                  <Zap size={14} />
                  <span className="font-display text-base">{profile.weeklyFocusMinutes}min</span>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* ─── Featured Achievements ──────────────────────────── */}
          {featured.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="glass-card mb-6 p-6 sm:p-8"
            >
              <div className="mb-5 flex items-center gap-2">
                <Star size={16} className="text-[var(--orange)]" />
                <span className="text-xs uppercase tracking-[0.15em] text-[var(--orange)]">Destaques</span>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-2">
                {featured.map((ach) => {
                  const colors = CATEGORY_COLORS[ach.category] ?? { primary: "#71d4ff", bg: "rgba(113,212,255,0.12)", glow: "rgba(113,212,255,0.4)" };
                  const Icon = ACHIEVEMENT_ICONS[ach.id] ?? DEFAULT_ICON;
                  return (
                    <div key={ach.id} className="flex shrink-0 flex-col items-center gap-2" style={{ width: 120 }}>
                      <button
                        type="button"
                        onClick={() => setSelectedAchievement(ach)}
                        className="group flex shrink-0 cursor-pointer flex-col items-center"
                      >
                        <div
                          className="flex items-center justify-center rounded-full"
                          style={{
                            width: 120,
                            height: 120,
                            background: `radial-gradient(circle at 30% 30%, ${colors.primary}, ${colors.bg})`,
                            boxShadow: `0 0 20px ${colors.glow}`,
                          }}
                        >
                          <Icon size={42} style={{ color: "#000" }} />
                        </div>
                      </button>
                      <span className="max-w-full truncate text-center text-[10px] text-[var(--text-muted)]">
                        {ach.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          )}

          {/* ─── Full Achievements Grid ─────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="glass-card p-6 sm:p-8"
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-[var(--accent)]" />
                <span className="text-xs uppercase tracking-[0.15em] text-[var(--accent)]">Conquistas</span>
              </div>
              <span className="text-xs text-[var(--text-faint)]">
                {unlocked.length} de {allSorted.length} desbloqueadas
              </span>
            </div>

            {allSorted.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                Nenhuma conquista disponível.
              </p>
            ) : (
              <motion.div
                variants={reduced ? {} : stagger}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
              >
                {allSorted.map((ach) => {
                  const colors = CATEGORY_COLORS[ach.category] ?? { primary: "#71d4ff", bg: "rgba(113,212,255,0.12)", glow: "rgba(113,212,255,0.4)" };
                  return (
                    <motion.button
                      key={ach.id}
                      variants={reduced ? {} : fadeUp}
                      whileHover={reduced ? undefined : { y: -3 }}
                      whileTap={reduced ? undefined : { scale: 0.97 }}
                      onClick={() => setSelectedAchievement(ach)}
                      className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center transition-colors hover:border-white/[0.12]"
                    >
                      <div
                        className="flex h-[80px] w-[80px] items-center justify-center rounded-full"
                        style={{
                          background: ach.unlockedTier > 0
                            ? `radial-gradient(circle at 30% 30%, ${colors.primary}, ${colors.bg})`
                            : "rgba(255,255,255,0.03)",
                          boxShadow: ach.unlockedTier > 0 ? `0 0 18px ${colors.glow}` : "none",
                          filter: ach.unlockedTier === 0 ? "grayscale(1) opacity(0.4)" : undefined,
                        }}
                      >
                        {ach.unlockedTier > 0 ? (
                          React.createElement(ACHIEVEMENT_ICONS[ach.id] ?? DEFAULT_ICON, {
                            size: 28,
                            style: { color: "#000" },
                          })
                        ) : (
                          <Lock size={22} className="text-[var(--text-faint)]" />
                        )}
                      </div>

                      <span className="text-xs text-[var(--text-secondary)]">{ach.title}</span>

                      {ach.unlockedTier > 0 && ach.thresholds.length > 1 && (
                        <div className="flex gap-1">
                          {ach.thresholds.map((_, i) => (
                            <span
                              key={i}
                              className="h-1.5 w-1.5 rounded-full"
                              style={{
                                background: i < ach.unlockedTier ? colors.primary : "rgba(255,255,255,0.1)",
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {ach.unlockedTier === 0 && (
                        <span className="text-[10px] text-[var(--text-faint)]">
                          {ach.currentValue}/{ach.thresholds[0]}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </motion.section>
        </div>
      </main>

      {/* ─── Achievement Detail Modal ────────────────────────────── */}
      {selectedAchievement && (
        <AchievementModal
          achievement={selectedAchievement}
          onClose={() => setSelectedAchievement(null)}
        />
      )}
    </AppShell>
  );
}
