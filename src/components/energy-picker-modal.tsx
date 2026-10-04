"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Lock, Store, X } from "lucide-react";
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

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function EnergyPickerModal({
  current,
  ownedAuras,
  onSelect,
  onClose,
}: EnergyPickerModalProps) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = "energy-picker-title";

  // Focus management: move into the dialog on open, restore to the trigger on
  // close, keep Tab cycling inside the dialog.
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

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

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={reduced ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-[14px] border border-white/10 bg-[#0d1b2d] sm:w-[min(560px,92vw)] sm:rounded-[14px]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 id={titleId} className="text-xs uppercase tracking-widest text-[var(--text-faint)]">
            Escolher energia
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:text-[var(--text)]"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body (scrollável) */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4">
          {groups.map(({ rarity, types }) => {
            const rarityColor = AURA_RARITY_COLORS[rarity];
            return (
              <section key={rarity}>
                {/* Header da seção: chip + linha flexível */}
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                    style={{ background: rarityColor.bg, color: rarityColor.border, border: `1px solid ${rarityColor.border}33` }}
                  >
                    {AURA_RARITY_LABELS[rarity]}
                  </span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}
                >
                  {types.map((type) => {
                    const cfg = ENERGY_CONFIGS[type];
                    const isOwned = ownedAuras.has(type);
                    const isSelected = type === current;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleAuraClick(type)}
                        title={
                          isOwned
                            ? cfg.label
                            : `${cfg.label} · ${AURA_RARITY_LABELS[AURA_DEFS[type].rarity]} — ir à loja`
                        }
                        aria-label={isOwned ? `Selecionar ${cfg.label}` : `${cfg.label} bloqueada, ir à loja`}
                        className="relative flex h-[118px] flex-col items-center justify-start gap-1.5 rounded-xl border p-2"
                        style={{
                          background: isSelected ? "rgba(113,212,255,0.10)" : "rgba(255,255,255,0.02)",
                          border: isSelected
                            ? "1px solid #71d4ff"
                            : `1px solid ${rarityColor.border}22`,
                          boxShadow: isSelected ? "0 0 12px rgba(113,212,255,0.35)" : undefined,
                          cursor: "pointer",
                        }}
                      >
                        {/* Badge da aura selecionada */}
                        {isSelected && (
                          <span
                            className="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full"
                            style={{ background: "#71d4ff" }}
                          >
                            <Check size={10} strokeWidth={3.5} className="text-white" />
                          </span>
                        )}

                        <Image
                          src={cfg.assets.full}
                          alt={cfg.label}
                          width={48}
                          height={48}
                          style={{
                            objectFit: "contain",
                            opacity: isOwned ? 1 : 0.5,
                            filter: isOwned ? undefined : "grayscale(0.9) brightness(0.7)",
                          }}
                          unoptimized
                        />

                        <span
                          className="text-[9px] leading-none"
                          style={{ color: isOwned ? "var(--text-secondary)" : "var(--text-faint)" }}
                        >
                          {cfg.label}
                        </span>

                        <span
                          className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                          style={{ background: rarityColor.bg, color: rarityColor.border, border: `1px solid ${rarityColor.border}33` }}
                        >
                          {AURA_RARITY_LABELS[AURA_DEFS[type].rarity]}
                        </span>

                        {/* Badge de cadeado para auras bloqueadas */}
                        {!isOwned && (
                          <span
                            className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full"
                            style={{ background: "rgba(7,17,31,0.75)" }}
                          >
                            <Lock size={9} className="text-[var(--text-muted)]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 px-5 py-3">
          <p className="text-[10px] text-[var(--text-faint)]">
            Auras bloqueadas podem ser compradas na Loja
          </p>
          <button
            type="button"
            onClick={handleStoreLink}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-3 py-2 text-[10px] font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
          >
            <Image src="/pop-ups/store_pop-up.png" alt="" width={14} height={14} unoptimized />
            Ir para a Loja
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
