"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sidebar, MobileNav } from "./navigation";
import { AppExtras } from "./app-extras";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();

  return (
    <div className="min-h-screen theme-bg">
      <AppExtras />
      <Sidebar pathname={pathname} />
      {/* Mobile: sticky brand bar + fixed bottom tab bar (with safe-area
          padding); the content reserves room for the tab bar below lg. */}
      <div className="lg:hidden">
        <MobileNav pathname={pathname} />
      </div>
      <div className="lg:pl-[252px]">
        <div className="mx-auto w-full max-w-[1500px] px-3 sm:px-4 pb-[calc(72px+env(safe-area-inset-bottom,0px))] pt-2 lg:px-6 lg:pb-0 lg:pt-4">
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
