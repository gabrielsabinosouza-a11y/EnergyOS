"use client";

import { useEffect, useState } from "react";
import { X, Timer } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/lib/api-client";
import type { PublicProfile } from "@/types";
import { Modal } from "@/components/modal";
import { Avatar } from "@/components/avatar";
import { AchievementBadge } from "@/lib/achievement-ui";

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

  return (
    <Modal onClose={onClose}>
      <div className="glass-card relative w-full max-w-sm overflow-hidden">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-[var(--text-muted)] transition hover:text-[var(--text)]"
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
            {profile.hasCustomBanner && profile.bannerImageUrl && (
              <div className="relative aspect-[3/1] w-full overflow-hidden bg-black/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profile.bannerImageUrl}
                  alt={`Banner de ${profile.displayName}`}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className={`p-6 ${profile.hasCustomBanner && profile.bannerImageUrl ? "pt-0" : ""}`}>
            {/* Avatar + name */}
            <div className={`flex items-center gap-4 ${profile.hasCustomBanner && profile.bannerImageUrl ? "-mt-6" : ""} mb-6`}>
              <Avatar
                photoUrl={profile.photoUrl}
                name={profile.displayName}
                size={56}
                equippedDecorationId={profile.equippedDecorationId}
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg tracking-tight">{profile.displayName}</h3>
                  {profile.role === "admin" && (
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--accent)] text-[var(--bg-primary)] rounded-full">
                      Admin
                    </span>
                  )}
                </div>
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
                      <AchievementBadge achievement={ach} size={40} iconSize={18} />
                      <span className="text-[9px] text-[var(--text-faint)] max-w-[48px] text-center leading-tight">{ach.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View full profile */}
            <Link
              href={`/perfil/${profile.id}`}
              onClick={onClose}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-bg)] px-4 py-2.5 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-bg)]/70"
            >
              Ver perfil completo
              <span aria-hidden>→</span>
            </Link>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
