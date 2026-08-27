"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export type ModalVariant = "center" | "bottom-sheet" | "side-right";

interface ModalProps {
  open?: boolean;
  onClose: () => void;
  children: ReactNode;
  variant?: ModalVariant;
  panelClassName?: string;
  zIndex?: number;
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
}: ModalProps) {
  const reduced = useReducedMotion();
  const isBottom = variant === "bottom-sheet";
  const isSide = variant === "side-right";

  const wrapperClassName = isSide
    ? "fixed inset-0 flex justify-end"
    : isBottom
      ? "fixed inset-0 flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
      : "fixed inset-0 flex items-center justify-center px-4";

  const panelStart = isSide
    ? { opacity: 0, x: "100%" }
    : { opacity: 0, scale: reduced ? 1 : 0.95, y: isBottom ? 24 : 0 };

  const panelDefaultClass = isSide
    ? "h-full w-full max-w-md sm:max-w-lg"
    : isBottom
      ? "w-full max-w-md"
      : "";

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
            className={`relative ${panelDefaultClass} ${panelClassName}`}
            initial={panelStart}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={panelStart}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}