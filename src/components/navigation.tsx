"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { LayoutDashboard, ListTodo, Settings, TrendingUp, UserPlus, Users, Trophy, Leaf, ShoppingBag, DoorOpen } from "lucide-react";

export const navigationItems = [
  { href: "/dashboard", label: "Visão geral",      icon: LayoutDashboard },
  { href: "/metas",     label: "Metas e hábitos",  icon: ListTodo },
  { href: "/salas-de-foco", label: "Salas de foco", icon: DoorOpen, badge: null },
  { href: "/amigos",    label: "Amigos",           icon: UserPlus,     badge: "social" as const },
  { href: "/liga",      label: "Liga",             icon: Trophy,       badge: null },
  { href: "/grupos",    label: "Grupos",           icon: Users,        badge: "social" as const },
  { href: "/loja",      label: "Loja",             icon: ShoppingBag,  badge: null },
  { href: "/jardim",    label: "Meu jardim",       icon: Leaf },
  { href: "/perfil",    label: "Meu perfil",       icon: TrendingUp },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar({ pathname }: { pathname: string }) {
  const reduced = useReducedMotion();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function fetchUnread() {
      try {
        const { auth } = await import("@/lib/firebase");
        const token = await auth?.currentUser?.getIdToken();
        if (!token || !active) return;
        const res = await fetch("/api/social/unread", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || !active) return;
        const data = await res.json();
        if (active) setUnreadCount(data.dmUnread + data.groupUnread);
      } catch { /* silent */ }
    }
    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  return (
    <aside className="hidden w-[252px] shrink-0 flex-col border-r border-[var(--border-subtle)] px-6 py-8 lg:fixed lg:inset-y-0 lg:flex">
      <Link href="/" className="mb-16 flex items-center gap-3 px-2">
        <Image src="/icons_8bits/logo.png" alt="energyOS" width={28} height={28} className="pixelated" />
        <span className="font-display text-xl font-semibold tracking-[-0.04em]">
          energy<span className="text-[#71d4ff]">OS</span>
        </span>
      </Link>

      <nav className="space-y-1">
        {navigationItems.map(({ href, label, icon: Icon, badge }) => {
          const isActive = pathname === href;
          const showBadge = badge === "social" && unreadCount > 0;
          return (
            <Link
              key={href}
              href={href}
              className={`nav-item relative ${isActive ? "active" : ""}`}
            >
              {isActive && (
                <motion.span
                  layoutId={reduced ? undefined : "nav-pill"}
                  className="absolute inset-0 rounded-lg bg-[var(--accent-bg)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  aria-hidden
                />
              )}
              {isActive && (
                <motion.span
                  layoutId={reduced ? undefined : "nav-bar"}
                  className="absolute left-0 top-[6px] bottom-[6px] w-[3px] rounded-r-[3px] bg-[var(--accent)]"
                  style={{ boxShadow: "0 0 10px var(--accent-glow)" }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  aria-hidden
                />
              )}
              <span className="relative z-10 flex items-center gap-[13px]">
                <Icon size={17} />
                <span>{label}</span>
                {showBadge && (
                  <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--orange)] px-1 text-[10px] font-bold text-black">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function Header({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="mb-10">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-[#71d4ff]">{eyebrow}</p>
      <h1 className="font-display text-3xl tracking-[-0.04em] sm:text-4xl">
        {title}<span className="text-[#ffb86b]">.</span>
      </h1>
    </header>
  );
}
