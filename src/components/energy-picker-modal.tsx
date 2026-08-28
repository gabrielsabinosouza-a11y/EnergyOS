"use client";

import Image from "next/image";
import { Lock, X } from "lucide-react";
import { Modal } from "@/components/modal";
import {
  AURA_DEFS,
  AURA_RARITY_COLORS,
  AURA_RARITY_LABELS,
  ENERGY_CONFIGS,
  ENERGY_TYPES,
  type EnergyType,
} from "@/lib/energy-assets";

interface EnergyPickerModalProps {
  current: string;
  ownedAuras: Set<string>;
  onSelect: (type: EnergyType) => void;
  onClose: () => void;
}

export function EnergyPickerModal({
  current,
  ownedAuras,
  onSelect,
  onClose,
}: EnergyPickerModalProps) {
  return (
    <Modal onClose={onClose} variant="bottom-sheet">
      <div className="glass-card w-full max-w-sm overflow-hidden p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-widest text-[var(--text-faint)]">Escolher energia</span>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] transition">
            <X size={15} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {ENERGY_TYPES.map((type) => {
            const cfg = ENERGY_CONFIGS[type];
            const isOwned = ownedAuras.has(type);
            const isSelected = type === current;
            const rarityColor = AURA_RARITY_COLORS[AURA_DEFS[type].rarity];
            return (
              <button
                key={type}
                onClick={() => {
                  if (isOwned) {
                    onSelect(type);
                    onClose();
                  }
                }}
                disabled={!isOwned}
                className="relative flex flex-col items-center gap-1.5 rounded-xl border p-2 transition"
                style={{
                  background: isSelected ? cfg.glow : "transparent",
                  border: isOwned
                    ? isSelected
                      ? `1px solid ${rarityColor.border}66`
                      : `1px solid ${rarityColor.border}22`
                    : "1px solid transparent",
                  opacity: isOwned ? 1 : 0.7,
                  cursor: isOwned ? "pointer" : "not-allowed",
                }}
                title={isOwned ? cfg.label : `${cfg.label} — ${AURA_RARITY_LABELS[AURA_DEFS[type].rarity]} · ir à loja`}
              >
                <div className="relative w-12 h-12">
                  <Image
                    src={cfg.assets.full}
                    alt={cfg.label}
                    fill
                    style={{ objectFit: "contain", opacity: isOwned ? 1 : 0.45 }}
                    unoptimized
                  />
                  {!isOwned && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-md">
                      <span
                        className="flex items-center justify-center rounded-full"
                        style={{ background: "rgba(7,17,31,0.75)", width: 30, height: 30 }}
                      >
                        <Lock size={15} className="text-[var(--text-muted)]" />
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-[9px] leading-none" style={{ color: isOwned ? "var(--text-secondary)" : "var(--text-faint)" }}>
                  {cfg.label}
                </span>
                <span
                  className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                  style={{
                    background: rarityColor.bg,
                    color: rarityColor.border,
                    border: `1px solid ${rarityColor.border}33`,
                  }}
                >
                  {AURA_RARITY_LABELS[AURA_DEFS[type].rarity]}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-center text-[10px] text-[var(--text-faint)]">
          Auras bloqueadas podem ser compradas na{" "}
          <a href="/loja" className="text-[var(--accent)] underline">Loja</a>
        </p>
      </div>
    </Modal>
  );
}
