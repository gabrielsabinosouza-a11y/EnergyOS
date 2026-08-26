"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Leaf } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/navigation";
import { useAuthRedirect } from "@/lib/auth-context";
import { getGardenEntries, type GardenEntry } from "@/lib/garden-store";
import { ENERGY_CONFIGS } from "@/lib/energy-assets";

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function JardimPage() {
  const { loading } = useAuthRedirect({ ifGuest: "/" });
  const [entries, setEntries] = useState<GardenEntry[]>([]);

  useEffect(() => {
    setEntries(getGardenEntries());
  }, []);

  const totalMinutes = entries.reduce((acc, e) => acc + e.durationMinutes, 0);

  if (loading) return null;

  return (
    <AppShell>
      <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <Header eyebrow="JARDIM" title="Meu jardim" />

          {/* Counters */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="panel p-4 text-center">
              <div className="text-2xl font-mono font-bold text-[var(--accent)]">{entries.length}</div>
              <div className="text-[10px] text-[var(--text-faint)] mt-0.5 uppercase tracking-wider">energias plantadas</div>
            </div>
            <div className="panel p-4 text-center">
              <div className="text-2xl font-mono font-bold text-[#ffb86b]">{totalMinutes}min</div>
              <div className="text-[10px] text-[var(--text-faint)] mt-0.5 uppercase tracking-wider">minutos de foco</div>
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="panel p-12 flex flex-col items-center gap-3 text-center">
              <Leaf size={32} className="text-[var(--text-faint)]" />
              <p className="text-sm text-[var(--text-muted)]">Seu jardim está vazio.</p>
              <p className="text-xs text-[var(--text-faint)]">Complete uma sessão de foco para plantar sua primeira energia.</p>
            </div>
          ) : (
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5"
            >
              {entries.map((entry) => {
                const cfg = ENERGY_CONFIGS[entry.energyType];
                const date = new Date(entry.plantedAt).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                });
                return (
                  <motion.div
                    key={entry.id}
                    variants={fadeUp}
                    className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3"
                    style={{ boxShadow: `0 0 16px -6px ${cfg.glow}` }}
                  >
                    <div className="relative w-14 h-14">
                      <Image
                        src={cfg.assets.full}
                        alt={cfg.label}
                        fill
                        style={{ objectFit: "contain" }}
                        unoptimized
                      />
                    </div>
                    <span className="text-[10px] font-medium text-[var(--text-secondary)]" style={{ color: cfg.accent }}>
                      {cfg.label}
                    </span>
                    <span className="text-[9px] text-[var(--text-faint)]">{date}</span>
                    <span className="text-[9px] text-[var(--text-faint)]">{entry.durationMinutes}min</span>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
