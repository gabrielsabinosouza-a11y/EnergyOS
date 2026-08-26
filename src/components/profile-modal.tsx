"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Timer, Trophy, Lock } from "lucide-react";
import Image from "next/image";
import { api } from "@/lib/api-client";
import type { PublicProfile } from "@/types";

interface ProfileModalProps {
  profileId: string;
  onClose: () => void;
}

export function ProfileModal({ profileId, onClose }: ProfileModalProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.getPublicProfile(profileId)
      .then((r) => { if (active) setProfile(r.profile); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profileId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const initials = profile?.displayName
    ? profile.displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 16 }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
        className="glass-card w-full max-w-sm overflow-hidden p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] transition"
        >
          <X size={16} />
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        ) : !profile ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">Perfil não encontrado.</p>
        ) : (
          <>
            {/* Avatar + name */}
            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 shrink-0 rounded-full overflow-hidden flex items-center justify-center bg-[var(--accent-bg)] text-lg font-bold text-[var(--accent)]">
                {profile.photoUrl
                  ? <img src={profile.photoUrl} alt={profile.displayName} className="h-full w-full object-cover" />
                  : initials}
              </div>
              <div>
                <h3 className="font-display text-lg tracking-tight">{profile.displayName}</h3>
                {profile.username && (
                  <p className="text-xs text-[var(--text-faint)]">@{profile.username}</p>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="rounded-xl bg-[var(--bg-surface-hover)] p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-[var(--orange)]">
                  <Image src="/energies/flame/flame_start.png" alt="streak" width={13} height={13} style={{ objectFit: "contain" }} unoptimized />
                  <span className="font-mono font-bold text-sm">{profile.currentStreak}</span>
                </div>
                <p className="text-[9px] text-[var(--text-faint)] mt-0.5">streak</p>
              </div>
              <div className="rounded-xl bg-[var(--bg-surface-hover)] p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-[var(--accent)]">
                  <Timer size={13} />
                  <span className="font-mono font-bold text-sm">{profile.weeklyFocusMinutes}</span>
                </div>
                <p className="text-[9px] text-[var(--text-faint)] mt-0.5">min/sem</p>
              </div>
              <div className="rounded-xl bg-[var(--bg-surface-hover)] p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-[var(--orange)]">
                  <Image src="/energies/flame/flame_start.png" alt="streak" width={13} height={13} style={{ objectFit: "contain" }} unoptimized />
                  <span className="font-mono font-bold text-sm">{profile.longestStreak}</span>
                </div>
                <p className="text-[9px] text-[var(--text-faint)] mt-0.5">recorde</p>
              </div>
            </div>

            {/* Featured achievements */}
            {profile.featuredAchievements.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-faint)] mb-3">Conquistas em destaque</p>
                <div className="flex gap-3 flex-wrap">
                  {profile.featuredAchievements.map((ach) => (
                    <div key={ach.id} className="flex flex-col items-center gap-1">
                      <div className="h-10 w-10 rounded-full bg-[var(--accent-bg)] flex items-center justify-center">
                        {ach.unlockedTier > 0
                          ? <Trophy size={18} className="text-[var(--accent)]" />
                          : <Lock size={14} className="text-[var(--text-faint)]" />}
                      </div>
                      <span className="text-[9px] text-[var(--text-faint)] max-w-[48px] text-center leading-tight">{ach.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
