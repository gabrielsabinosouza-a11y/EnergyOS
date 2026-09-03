"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Settings, TrendingUp, UserPlus, Users, Trophy,
  Leaf, ShoppingBag, DoorOpen, MoreHorizontal, X, Library,
} from "lucide-react";
import { Modal } from "./modal";

export const navigationItems = [
  { href: "/dashboard", label: "Visão geral",      icon: LayoutDashboard, img: "/sidebar_menu/dashboard.png" },
  { href: "/salas-de-foco", label: "Salas de foco", icon: DoorOpen, badge: null, img: "/sidebar_menu/rooms.png" },
  { href: "/amigos",    label: "Amigos",           icon: UserPlus,     badge: "social" as const, img: "/sidebar_menu/friends.png" },
  { href: "/liga",      label: "Liga",             icon: Trophy,       badge: null, img: "/sidebar_menu/leaderboard.png" },
  { href: "/grupos",    label: "Grupos",           icon: Users,        badge: "social" as const, img: "/sidebar_menu/groups.png" },
  { href: "/loja",      label: "Loja",             icon: ShoppingBag,  badge: null, img: "/sidebar_menu/store.png" },
  { href: "/jardim",    label: "Meu jardim",       icon: Leaf, img: "/sidebar_menu/garden.png" },
  { href: "/perfil",    label: "Meu perfil",       icon: TrendingUp, img: "/sidebar_menu/profile.png" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, img: "/sidebar_menu/settings.png" },
];

/* Bottom tab bar: the 4 most frequently used sections get permanent,
   thumb-reachable tabs; everything else lives behind "Mais". */
const PRIMARY_TABS = [
  { href: "/dashboard",     label: "Início", icon: LayoutDashboard },
  { href: "/salas-de-foco", label: "Foco",   icon: DoorOpen },
  { href: "/amigos",        label: "Amigos", icon: UserPlus, badge: "social" as const },
  { href: "/liga",          label: "Liga",   icon: Trophy },
] as const;

const MORE_TABS = [
  { href: "/grupos",        label: "Grupos",          icon: Users,      badge: "social" as const },
  { href: "/loja",          label: "Loja",            icon: ShoppingBag },
  { href: "/jardim",        label: "Meu jardim",      icon: Leaf },
  { href: "/perfil",        label: "Meu perfil",      icon: TrendingUp },
  { href: "/configuracoes", label: "Configurações",   icon: Settings },
] as const;

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Unread social count — one poller shared by the desktop sidebar and the
 *  mobile tab bar so we never double-poll `/api/social/unread`. */
function useUnreadCount() {
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
  return unreadCount;
}

export function Sidebar({ pathname }: { pathname: string }) {
  const reduced = useReducedMotion();
  const unreadCount = useUnreadCount();

  return (
    <aside className="hidden w-[252px] shrink-0 flex-col border-r border-[var(--border-subtle)] px-6 py-8 lg:fixed lg:inset-y-0 lg:flex">
      <Link href="/" className="mb-16 flex items-center gap-3 px-2">
        <Image src="/icons_8bits/logo.png" alt="energyOS" width={28} height={28} className="pixelated" />
        <span className="font-display text-xl font-semibold tracking-[-0.04em]">
          energy<span className="text-[#71d4ff]">OS</span>
        </span>
      </Link>

      <nav className="space-y-1">
        {navigationItems.map(({ href, label, icon: Icon, badge, img }) => {
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
                {img ? (
                  <Image
                    src={img}
                    alt=""
                    width={30}
                    height={30}
                    className="shrink-0 object-contain"
                  />
                ) : (
                  <Icon size={30} />
                )}
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

/* ═══════════════════════ MOBILE NAVIGATION (<lg) ═══════════════════════
   Compact sticky brand bar on top + fixed bottom tab bar with a "Mais"
   bottom sheet. Bottom tabs beat hamburger-only patterns for apps opened
   many times a day (check-ins, timers): primary destinations are one
   thumb-tap away. */
export function MobileNav({ pathname }: { pathname: string }) {
  const unreadCount = useUnreadCount();
  const [showMore, setShowMore] = useState(false);

  // Close the "Mais" sheet whenever the route changes.
  useEffect(() => { setShowMore(false); }, [pathname]);

  const moreActive = MORE_TABS.some(({ href }) => isActivePath(pathname, href));

  return (
    <>
      {/* Compact brand top bar */}
      <div className="mobile-topbar lg:hidden">
        <Link href="/" className="flex items-center gap-2.5" aria-label="energyOS — início">
          <Image src="/icons_8bits/logo.png" alt="" width={24} height={24} className="pixelated" />
          <span className="font-display text-lg font-semibold tracking-[-0.04em]">
            energy<span className="text-[#71d4ff]">OS</span>
          </span>
        </Link>
      </div>

      {/* Bottom tab bar */}
      <nav className="bottom-tabbar lg:hidden" aria-label="Navegação principal">
        <div className="flex items-stretch">
          {PRIMARY_TABS.map(({ href, label, icon: Icon, ...rest }) => {
            const badge = "badge" in rest ? rest.badge : undefined;
            const active = isActivePath(pathname, href);
            const showDot = badge === "social" && unreadCount > 0;
            return (
              <Link key={href} href={href} className={`tab-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
                <span className="tab-icon">
                  <Icon size={21} strokeWidth={active ? 2.3 : 2} />
                  {showDot && <span className="tab-dot" aria-label="Mensagens não lidas" />}
                </span>
                <span className="tab-label">{label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className={`tab-item ${moreActive ? "active" : ""}`}
            aria-expanded={showMore}
          >
            <span className="tab-icon">
              <MoreHorizontal size={21} strokeWidth={moreActive ? 2.3 : 2} />
            </span>
            <span className="tab-label">Mais</span>
          </button>
        </div>
      </nav>

      {/* "Mais" — bottom sheet with the remaining sections */}
      {showMore && (
        <Modal open={showMore} onClose={() => setShowMore(false)} variant="bottom-sheet">
          <div className="glass-card w-full max-w-md overflow-hidden rounded-b-none! p-2 sm:rounded-b-[14px]!" role="menu" aria-label="Mais seções">
            <div className="flex items-center justify-between px-4 pb-1 pt-3">
              <span className="eyebrow muted"><Library size={12} /> MAIS SEÇÕES</span>
              <button
                type="button"
                onClick={() => setShowMore(false)}
                aria-label="Fechar"
                className="tap flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-faint)] transition hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text)]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 p-2">
              {MORE_TABS.map(({ href, label, icon: Icon, ...rest }) => {
                const badge = "badge" in rest ? rest.badge : undefined;
                const active = isActivePath(pathname, href);
                const showDot = badge === "social" && unreadCount > 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    role="menuitem"
                    className={`relative flex min-h-[56px] items-center gap-3 rounded-xl border px-3.5 py-3 text-[13px] font-medium transition ${
                      active
                        ? "border-[var(--accent)]/40 bg-[var(--accent-bg)] text-[var(--accent)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text)]"
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="truncate">{label}</span>
                    {showDot && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[var(--orange)] shadow-[0_0_8px_rgba(255,184,107,.6)]" aria-label="Mensagens não lidas" />}
                  </Link>
                );
              })}
            </div>
          </div>
        </Modal>
      )}
    </>
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
