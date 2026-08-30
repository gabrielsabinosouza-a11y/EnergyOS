"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sidebar } from "./navigation";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();

  return (
    <div className="min-h-screen theme-bg">
      <Sidebar pathname={pathname} />
      <div className="lg:pl-[252px]">
        <div className="mx-auto max-w-[1500px]">
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
