"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { navigationItems } from "@/shared/navigation-config";
import type { NavigationItem } from "@/shared/navigation-config";

function iconPath(icon: NavigationItem["icon"]) {
  return `/sidebar_menu/${icon === "league" ? "leaderboard" : icon}.png`;
}

function isActivePath(pathname: string, href: string) {
  // "/dashboard" é a raiz de subrotas (ex.: /dashboard/consistencia): só fica
  // ativo no path exato, senão a página filha acenderia o tab de "Início".
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Unread counts kept apart: `dmUnread` drives the Amigos badge and
 *  `groupUnread` drives the Grupos badge. One poller shared by the desktop
 *  sidebar and the mobile tab bar so we never double-poll `/api/social/unread`. */
function useUnreadCounts() {
  const [counts, setCounts] = useState({ dmUnread: 0, groupUnread: 0 });
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
        if (active) {
          setCounts({
            dmUnread: Number(data.dmUnread ?? 0),
            groupUnread: Number(data.groupUnread ?? 0),
          });
        }
      } catch { /* silent */ }
    }
    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    return () => { active = false; clearInterval(interval); };
  }, []);
  return counts;
}

/** Badge count for a nav item given its badge kind and the unread counts. */
function badgeCountFor(kind: "dm" | "group" | null | undefined, counts: { dmUnread: number; groupUnread: number }): number {
  if (kind === "dm") return counts.dmUnread;
  if (kind === "group") return counts.groupUnread;
  return 0;
}

export function Sidebar({ pathname }: { pathname: string }) {
  const reduced = useReducedMotion();
  const unreadCounts = useUnreadCounts();

  return (
    <aside className="hidden w-[252px] shrink-0 flex-col border-r border-[var(--border-subtle)] px-6 py-8 lg:fixed lg:inset-y-0 lg:flex">
      <Link href="/" className="mb-16 flex items-center gap-3 px-2">
        <Image src="/icons_8bits/logo.png" alt="energyOS" width={28} height={28} className="pixelated" />
        <span className="font-display text-xl font-semibold tracking-[-0.04em]">
          energy<span className="text-[#71d4ff]">OS</span>
        </span>
      </Link>

      <nav className="space-y-1">
        {navigationItems.map(({ route, label, icon, badge }) => {
          const isActive = pathname === route;
          const unreadCount = badgeCountFor(badge, unreadCounts);
          const showBadge = unreadCount > 0;
          return (
            <Link
              key={route}
              href={route}
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
                <Image
                  src={iconPath(icon)}
                  alt=""
                  width={30}
                  height={30}
                  className="shrink-0 object-contain"
                />
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

/* Compact sticky brand bar and horizontally scrollable mobile navigation. */
export function MobileNav({ pathname }: { pathname: string }) {
  const unreadCounts = useUnreadCounts();
  const reduced = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialScroll = useRef(true);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const suppressTimer = useRef<number | null>(null);
  const activeItem = navigationItems.find(({ route, mobileRoute }) => (
    isActivePath(pathname, route) || isActivePath(pathname, mobileRoute)
  ));
  const [edges, setEdges] = useState({ left: false, right: true });

  const updateEdges = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const nextEdges = {
      left: element.scrollLeft > 2,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - 2,
    };
    setEdges((current) => (
      current.left === nextEdges.left && current.right === nextEdges.right
        ? current
        : nextEdges
    ));
  }, []);

  useEffect(() => {
    if (!activeItem) return;
    const element = scrollRef.current?.querySelector<HTMLElement>(
      `[data-mobile-nav-item="${activeItem.id}"]`,
    );
    if (!element) return;
    element.scrollIntoView({
      behavior: initialScroll.current || reduced ? "instant" : "smooth",
      block: "nearest",
      inline: "center",
    });
    initialScroll.current = false;
    requestAnimationFrame(updateEdges);
  }, [activeItem, reduced, updateEdges]);

  useEffect(() => {
    const handleResize = () => updateEdges();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateEdges]);

  useEffect(() => () => {
    if (suppressTimer.current !== null) window.clearTimeout(suppressTimer.current);
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    pointerStart.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const deltaX = Math.abs(event.clientX - start.x);
    const deltaY = Math.abs(event.clientY - start.y);
    if (deltaX > 10 && deltaX > deltaY) {
      suppressClick.current = true;
      if (suppressTimer.current !== null) window.clearTimeout(suppressTimer.current);
      suppressTimer.current = window.setTimeout(() => {
        suppressClick.current = false;
        suppressTimer.current = null;
      }, 0);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const links = Array.from(
      scrollRef.current?.querySelectorAll<HTMLAnchorElement>("[data-mobile-nav-item]") ?? [],
    );
    const currentIndex = links.indexOf(event.currentTarget);
    const target = links[currentIndex + (event.key === "ArrowRight" ? 1 : -1)];
    if (!target) return;
    event.preventDefault();
    target.focus();
    target.scrollIntoView({ behavior: reduced ? "instant" : "smooth", inline: "center", block: "nearest" });
  }

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
        <div className="bottom-tabbar-glass">
          <div
            className="bottom-tabbar-scroll"
            onPointerDownCapture={handlePointerDown}
            onPointerUpCapture={handlePointerUp}
            onPointerCancelCapture={() => { pointerStart.current = null; }}
            onClickCapture={(event) => {
              if (!suppressClick.current) return;
              event.preventDefault();
              event.stopPropagation();
              suppressClick.current = false;
              if (suppressTimer.current !== null) window.clearTimeout(suppressTimer.current);
              suppressTimer.current = null;
            }}
            onScroll={updateEdges}
            ref={scrollRef}
          >
            {navigationItems.map(({ id, route, label, shortLabel, icon, badge }) => {
              const active = activeItem?.id === id;
              const unreadCount = badgeCountFor(badge, unreadCounts);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  aria-label={unreadCount > 0 ? `${label}, ${unreadCount} mensagens não lidas` : label}
                  className={`tab-item ${active ? "active" : ""}`}
                  data-mobile-nav-item={id}
                  href={route}
                  key={id}
                  onKeyDown={handleKeyDown}
                >
                  {active && (
                    <motion.span
                      aria-hidden="true"
                      className="tab-active-pill"
                      layoutId={reduced ? undefined : "mobile-nav-active-pill"}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="tab-icon">
                    <Image src={iconPath(icon)} alt="" width={25} height={25} className="shrink-0 object-contain" />
                    {unreadCount > 0 && (
                      <span className="tab-dot" aria-label={`${unreadCount} mensagens não lidas`} />
                    )}
                  </span>
                  <span className="tab-label">{shortLabel}</span>
                </Link>
              );
            })}
          </div>
          {edges.left && <span aria-hidden="true" className="bottom-tabbar-fade bottom-tabbar-fade-left" />}
          {edges.right && <span aria-hidden="true" className="bottom-tabbar-fade bottom-tabbar-fade-right" />}
        </div>
      </nav>
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
