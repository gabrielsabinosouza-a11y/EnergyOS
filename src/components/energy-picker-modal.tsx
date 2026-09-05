"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Lock, Store, X } from "lucide-react";
import { Modal } from "@/components/modal";
import {
  AURA_DEFS,
  AURA_RARITY_COLORS,
  AURA_RARITY_LABELS,
  ENERGY_CONFIGS,
  ENERGY_TYPES,
  type AuraRarity,
  type EnergyType,
} from "@/lib/energy-assets";

interface EnergyPickerModalProps {
  current: string;
  ownedAuras: Set<string>;
  onSelect: (type: EnergyType) => void;
  onClose: () => void;
}

// Ordem de exibição: das auras mais comuns às épicas, com cabeçalho por raridade.
const RARITY_ORDER: AuraRarity[] = ["common", "uncommon", "rare", "epic"];

export function EnergyPickerModal({
  current,
  ownedAuras,
  onSelect,
  onClose,
}: EnergyPickerModalProps) {
  const router = useRouter();
  const reduced = useReducedMotion();

  function handleAuraClick(type: EnergyType) {
    if (ownedAuras.has(type)) {
      onSelect(type);
      onClose();
      return;
    }
    // Aura bloqueada → leva direto à seção de Auras da Loja.
    onClose();
    router.push("/loja?section=auras");
  }

  function handleStoreLink() {
    onClose();
    router.push("/loja?section=auras");
  }

  const groups = RARITY_ORDER.map((rarity) => ({
    rarity,
    types: ENERGY_TYPES.filter((t) => AURA_DEFS[t].rarity === rarity),
  })).filter((group) => group.types.length > 0);

  return (
    <Modal onClose={onClose} variant="bottom-sheet">
      <div className="glass-card w-full max-w-sm overflow-hidden p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-widest text-[var(--text-faint)]">Escolher energia</span>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] transition">
            <X size={15} />
          </button>
        </div>

        <div className="max-h-[62dvh] space-y-4 overflow-y-auto overscroll-contain pr-1 -mr-1">
          {groups.map(({ rarity, types }) => {
            const rarityColor = AURA_RARITY_COLORS[rarity];
            return (
              <div key={rarity}>
                {/* Cabeçalho do grupo de raridade */}
                <div className="mb-2 flex items-center gap-2 px-0.5">
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                    style={{ background: rarityColor.bg, color: rarityColor.border, border: `1px solid ${rarityColor.border}33` }}
                  >
                    {AURA_RARITY_LABELS[rarity]}
                  </span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {types.map((type, index) => {
                    const cfg = ENERGY_CONFIGS[type];
                    const isOwned = ownedAuras.has(type);
                    const isSelected = type === current;
                    return (
                      <motion.button
                        key={type}
                        onClick={() => handleAuraClick(type)}
                        initial={reduced ? false : { opacity: 0, y: 10, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        whileTap={reduced ? undefined : { scale: isOwned ? 0.92 : 0.97 }}
                        whileHover={reduced || !isOwned ? undefined : { y: -2 }}
                        transition={{ type: "spring", stiffness: 420, damping: 30, delay: index * 0.03 }}
                        className="relative flex flex-col items-center gap-1.5 rounded-xl border p-2"
                        style={{
                          background: isSelected ? cfg.glow : "rgba(255,255,255,0.02)",
                          border: isSelected
                            ? `1px solid ${rarityColor.border}`
                            : `1px solid ${rarityColor.border}22`,
                          cursor: "pointer",
                        }}
                        title={
                          isOwned
                            ? cfg.label
                            : `${cfg.label} · ${AURA_RARITY_LABELS[AURA_DEFS[type].rarity]} — ir à loja`
                        }
                        aria-label={isOwned ? `Selecionar ${cfg.label}` : `${cfg.label} bloqueada, ir à loja`}
                      >
                        {/* Badge da aura atualmente selecionada */}
                        {isSelected && (
                          <motion.span
                            initial={reduced ? false : { scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 420, damping: 20, delay: 0.05 }}
                            className="absolute top-1 right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full"
                            style={{ background: cfg.accent }}
                          >
                            <Check size={10} strokeWidth={3.5} className="text-white" />
                          </motion.span>
                        )}

                        <div className="relative h-12 w-12">
                          <Image
                            src={cfg.assets.full}
                            alt={cfg.label}
                            fill
                            style={{
                              objectFit: "contain",
                              opacity: isOwned ? 1 : 0.5,
                              filter: isOwned ? undefined : "grayscale(0.9) brightness(0.7)",
                            }}
                            unoptimized
                          />
                          {!isOwned && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-md">
                              <span
                                className="flex items-center justify-center rounded-full"
                                style={{ background: "rgba(7,17,31,0.75)", width: 28, height: 28 }}
                              >
                                <Lock size={13} className="text-[var(--text-muted)]" />
                              </span>
                            </div>
                          )}
                        </div>

                        <span className="text-[9px] leading-none" style={{ color: isOwned ? "var(--text-secondary)" : "var(--text-faint)" }}>
                          {cfg.label}
                        </span>

                        <span
                          className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                          style={{ background: rarityColor.bg, color: rarityColor.border, border: `1px solid ${rarityColor.border}33` }}
                        >
                          {AURA_RARITY_LABELS[AURA_DEFS[type].rarity]}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleStoreLink}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 py-2 text-[10px] font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
        >
          <Store size={12} />
          Auras bloqueadas podem ser compradas na Loja
        </button>
      </div>
    </Modal>
  );
}