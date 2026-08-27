"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export type ModalVariant = "center" | "bottom-sheet";

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
          className={`fixed inset-0 flex justify-center ${
            isBottom ? "items-end px-4 pb-4 sm:items-center sm:pb-0" : "items-center px-4"
          }`}
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
            className={`relative ${isBottom ? "w-full max-w-md" : ""} ${panelClassName}`}
            initial={{
              opacity: 0,
              scale: reduced ? 1 : 0.95,
              y: isBottom ? 24 : 0,
            }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: reduced ? 1 : 0.95,
              y: isBottom ? 24 : 0,
            }}
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