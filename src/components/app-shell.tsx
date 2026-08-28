"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Sidebar } from "./navigation";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { auth } = await import("@/lib/firebase");
        const token = await auth?.currentUser?.getIdToken();
        if (!token || !active) return;
        const res = await fetch("/api/profile", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok || !active) return;
        const data = await res.json();
        if (active) setStreak(data.user?.currentStreak ?? 0);
      } catch { /* silent */ }
    }
    load();
    return () => { active = false; };
  }, []);

  return (
    <div className="min-h-screen theme-bg">
      <Sidebar pathname={pathname} />
      <div className="lg:pl-[252px]">
        <div className="mx-auto max-w-[1500px]">
          {streak > 0 && (
            <div
              className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5 shadow-lg backdrop-blur-md"
              title={`Streak de ${streak} ${streak === 1 ? "dia" : "dias"}`}
            >
              <Image src="/energies/flame/flame_start.png" alt="" width={16} height={16} className="object-contain" unoptimized />
              <span className="font-mono text-sm font-bold leading-none text-[var(--orange)]">{streak}</span>
            </div>
          )}
          <motion.div
            key={pathname}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
