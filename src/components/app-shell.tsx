"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "./navigation";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className="min-h-screen bg-[#07111f] text-[#e7f4ff]"><Sidebar pathname={pathname} /><div className="lg:pl-[252px]"><div className="mx-auto max-w-[1500px]">{children}</div></div></div>;
}
