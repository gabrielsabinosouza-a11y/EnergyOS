"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export type ModalVariant = "center" | "bottom-sheet" | "side-right";
/**
 * Superfície do painel.
 * - "solid": fundo opaco (padrão, usado no restante do app).
 * - "glass": camada translúcida navy com blur, brilho ambiente e highlights
 *   internos — o visual "3D glass" do energyOS.
 */
export type ModalSurface = "solid" | "glass";

interface ModalProps {
  open?: boolean;
  onClose: () => void;
  children: ReactNode;
  variant?: ModalVariant;
  panelClassName?: string;
  zIndex?: number;
  /** Estilo da superfície do painel. */
  surface?: ModalSurface;
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
  surface = "solid",
  title,
  description,
  footer,
  headerClassName = "",
  footerClassName = "",
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // O callback vive num ref: assim o efeito de teclado/foco NÃO depende da
  // identidade da função. Sem isso, um `onClose` inline (típico) faria o
  // efeito rodar a cada render — e o refocus steals the caret do input.
  const onCloseRef = useRef(onClose);
  const reduced = useReducedMotion();
  const isBottom = variant === "bottom-sheet";
  const isSide = variant === "side-right";
  const isGlass = surface === "glass";
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

  // Mantém o ref do callback atualizado sem re-registrar os listeners.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      // Skip processing if focus is in an input/textarea - fixes typing bugs
      const active = document.activeElement;
      if (active) {
        const tagName = active.tagName.toLowerCase();
        if (tagName === "input" || tagName === "textarea") return;
      }

      if (event.key === "Escape") onCloseRef.current();
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // O foco inicial só é aplicado NA ABERTURA (o efeito depende apenas de
    // `open`). Reexecutá-lo a cada render fazia o painel roubar o foco do
    // campo que o usuário estava digitando.
    requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      // Se o foco já está dentro do diálogo, não mexe nele.
      if (dialog.contains(document.activeElement)) return;
      const autofocus = dialog.querySelector<HTMLElement>("[autofocus], [data-autofocus]");
      (autofocus ?? dialog).focus();
    });
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (typeof document === "undefined") return null;

  const structuredPanelClass =
    "flex max-h-[min(90dvh,720px)] w-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] max-sm:max-h-[96dvh] max-sm:rounded-b-none " +
    // `bg-primary` é totalmente opaco (fundo base do app): nada de trasparência.
    "bg-[var(--bg-primary)] shadow-[0_24px_60px_-12px_rgba(0,0,0,.65)]";

  // Superfície 3D glass: navy translúcido em camadas, blur, halo ciano e
  // highlight interno — sem borda pesada.
  const glassPanelClass =
    "flex max-h-[min(90dvh,720px)] w-full flex-col overflow-hidden rounded-[22px] max-sm:max-h-[96dvh] max-sm:rounded-b-none " +
    "border border-white/[.08] bg-[linear-gradient(158deg,rgba(23,44,74,.78)_0%,rgba(10,22,40,.86)_46%,rgba(6,14,26,.9)_100%)] " +
    "backdrop-blur-2xl backdrop-saturate-150 " +
    "shadow-[0_34px_90px_-24px_rgba(0,0,0,.8),0_0_70px_-30px_rgba(113,212,255,.45),inset_0_1px_0_rgba(255,255,255,.14),inset_0_-1px_0_rgba(113,212,255,.07)]";

  const panelSurfaceClass = isGlass ? glassPanelClass : structuredPanelClass;
  const separatorClass = isGlass ? "border-white/[.08]" : "border-[var(--border-subtle)]";
  const headerTitleClass = isGlass
    ? "font-display text-lg leading-tight tracking-tight text-[var(--text)] [text-shadow:0_1px_12px_rgba(113,212,255,.18)]"
    : "font-display text-lg leading-tight text-[var(--text)]";

  const structuredContent = structured ? (
    <>
      <div
        className={`flex shrink-0 items-start gap-3 border-b ${separatorClass} px-5 py-4 sm:px-6 ${headerClassName}`}
      >
        <div className="min-w-0 flex-1">
          <div className={headerTitleClass}>{title}</div>
          {description ? (
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className={`-mr-1 -mt-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--text-muted)] transition ${
            isGlass
              ? "border border-transparent hover:border-white/10 hover:bg-white/[.07] hover:text-[var(--text)]"
              : "hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text)]"
          }`}
        >
          <X size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6 [scrollbar-width:thin]">{children}</div>
      {footer !== undefined ? (
        <div
          className={`sticky bottom-0 flex shrink-0 items-center gap-2 border-t ${separatorClass} px-5 py-4 sm:px-6 ${
            isGlass
              ? "bg-[linear-gradient(180deg,rgba(8,18,33,.55),rgba(8,18,33,.78))] backdrop-blur-xl"
              : "bg-[color-mix(in_srgb,var(--bg-primary)_88%,transparent)] backdrop-blur-xl"
          } ${footerClassName}`}
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
          // O wrapper não anima opacidade: cada camada (fundo e painel) tem a
          // sua própria curva, então o "fade" do fundo é independente do
          // movimento do painel.
          exit={{ opacity: 1 }}
        >
          <motion.div
            className={`absolute inset-0 ${isGlass ? "bg-[rgba(3,8,17,.72)] backdrop-blur-md" : "bg-black/60 backdrop-blur-sm"}`}
            onClick={onClose}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.24, ease: "easeOut" }}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className={`relative ${structured ? panelSurfaceClass : panelDefaultClass} ${panelClassName}`}
            initial={panelStart}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={panelStart}
            transition={{ duration: reduced ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {isGlass ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-28 h-56 rounded-full bg-[radial-gradient(58%_58%_at_50%_50%,rgba(113,212,255,.20),transparent_72%)] blur-2xl"
              />
            ) : null}
            {isGlass && structured ? (
              <div className="relative z-10 flex min-h-0 flex-1 flex-col">{structuredContent}</div>
            ) : (
              structuredContent
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
