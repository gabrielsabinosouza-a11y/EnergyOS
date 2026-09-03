"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCheck,
  BellOff,
  BellRing,
  LogOut,
  Pin,
  UserMinus,
} from "lucide-react";

export interface ConversationMenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "danger";
}

export function ConversationContextMenu({
  x,
  y,
  actions,
  onClose,
}: {
  x: number;
  y: number;
  actions: ConversationMenuAction[];
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    if (!menuRef.current) return;
    const el = menuRef.current;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nx = x;
    let ny = y;
    if (x + rect.width > vw - 8) nx = vw - rect.width - 8;
    if (y + rect.height > vh - 8) ny = vh - rect.height - 8;
    if (nx < 8) nx = 8;
    if (ny < 8) ny = 8;
    setPos({ x: nx, y: ny });
  }, [x, y]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[9999]" onClick={onClose}>
      <div
        ref={menuRef}
        onClick={(e) => e.stopPropagation()}
        className="fixed min-w-[180px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1 shadow-2xl backdrop-blur-xl"
        style={{ left: pos.x, top: pos.y }}
      >
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={() => {
              action.onClick();
              onClose();
            }}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition ${
              action.variant === "danger"
                ? "text-[var(--red)] hover:bg-[var(--red)]/10"
                : "text-[var(--text)] hover:bg-[var(--accent-bg)]"
            }`}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

/** Convenience helpers for common conversation actions */
export const convActions = {
  markAsRead: (onClick: () => void): ConversationMenuAction => ({
    label: "Marcar como lida",
    icon: <CheckCheck size={14} />,
    onClick,
  }),
  mute: (onClick: () => void): ConversationMenuAction => ({
    label: "Silenciar",
    icon: <BellOff size={14} />,
    onClick,
  }),
  unmute: (onClick: () => void): ConversationMenuAction => ({
    label: "Ativar som",
    icon: <BellRing size={14} />,
    onClick,
  }),
  pin: (onClick: () => void): ConversationMenuAction => ({
    label: "Fixar",
    icon: <Pin size={14} />,
    onClick,
  }),
  leave: (onClick: () => void): ConversationMenuAction => ({
    label: "Sair do grupo",
    icon: <LogOut size={14} />,
    onClick,
    variant: "danger",
  }),
  unfriend: (onClick: () => void): ConversationMenuAction => ({
    label: "Remover amigo",
    icon: <UserMinus size={14} />,
    onClick,
    variant: "danger",
  }),
};
