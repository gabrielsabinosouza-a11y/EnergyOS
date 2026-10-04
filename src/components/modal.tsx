"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export type ModalVariant = "center" | "bottom-sheet" | "side-right";

interface ModalProps {
  open?: boolean;
  onClose: () => void;
  children: ReactNode;
  variant?: ModalVariant;
  panelClassName?: string;
  zIndex?: number;
  /**
   * Título do cabeçalho fixo. Ao informar `title` (ou `footer`), o painel vira a
   * versão ESTRUTURADA: fundo opaco, max-height 85vh, cabeçalho/rodapé fixos e
   * corpo rolável — o conteúdo atrás (ex.: card de Foco) nunca aparece.
   */
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  /** Classe extra do cabeçalho/rodapé (alinhamento, borda inferior…). */
  headerClassName?: string;
  footerClassName?: string;
}

// Portaled to document.body so no parent stacking context can ever trap or
// override the modal's z-index, no matter how the page is composed.
export const MODAL_Z_INDEX = 999;

export function Modal({
  open = true,
  onClose,
  children,
  variant = "center",
  panelClassName = "",
  zIndex = MODAL_Z_INDEX,
  title,
  description,
  footer,
  headerClassName = "",
  footerClassName = "",
}: ModalProps) {
  const reduced = useReducedMotion();
  const isBottom = variant === "bottom-sheet";
  const isSide = variant === "side-right";
  // Modo estruturado: cabeçalho/rodapé fixos + corpo rolável + fundo opaco.
  const structured = title !== undefined || footer !== undefined;

  const wrapperClassName = isSide
    ? "fixed inset-x-0 top-0 flex h-[100dvh] items-stretch justify-end"
    : isBottom
      ? "fixed inset-0 flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
      // Center modals become full-width bottom sheets on <sm viewports
      // (native mobile pattern), centered dialogs from `sm:` up.
      : "fixed inset-0 flex items-end justify-center sm:items-center sm:px-4";

  const panelStart = isSide
    ? { opacity: 0, x: "100%" }
    : { opacity: 0, scale: reduced ? 1 : 0.95, y: reduced ? 0 : 24 };

  const panelDefaultClass = isSide
    ? "h-full w-full max-w-md sm:max-w-lg"
    : isBottom
      ? "w-full max-w-md"
      : "max-sm:w-full max-sm:max-h-[92dvh] max-sm:overflow-y-auto max-sm:overscroll-contain max-sm:rounded-b-none!";

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const structuredPanelClass =
    "flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] " +
    // `bg-primary` é totalmente opaco (fundo base do app): nada de trasparência.
    "bg-[var(--bg-primary)] shadow-[0_24px_60px_-12px_rgba(0,0,0,.65)]";

  const structuredContent = structured ? (
    <>
      <div
        className={`flex shrink-0 items-start gap-3 border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6 ${headerClassName}`}
      >
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg leading-tight text-[var(--text)]">{title}</div>
          {description ? (
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text)]"
        >
          <X size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
      {footer !== undefined ? (
        <div
          className={`flex shrink-0 items-center gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-primary)] px-5 py-4 sm:px-6 ${footerClassName}`}
        >
          {footer}
        </div>
      ) : null}
    </>
  ) : (
    children
  );

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={wrapperClassName}
          style={{ zIndex }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`relative ${structured ? structuredPanelClass : panelDefaultClass} ${panelClassName}`}
            initial={panelStart}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={panelStart}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
          >
            {structuredContent}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}