"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Modal } from "@/components/modal";
import {
  Copy,
  Check,
  Share2,
  Link2,
} from "lucide-react";

const PLATFORMS = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    color: "#25D366",
    icon: "whatsapp",
    build: (url: string, text: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    id: "discord",
    label: "Discord",
    color: "#5865F2",
    icon: "discord",
    build: (url: string, text: string) =>
      `https://discord.com/channels/@me?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    id: "telegram",
    label: "Telegram",
    color: "#229ED9",
    icon: "telegram",
    build: (url: string, text: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
];

function PlatformIcon({ name, size = 22 }: { name: string; size?: number }) {
  if (name === "whatsapp") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#25D366">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    );
  }
  if (name === "telegram") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#229ED9">
        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    );
  }
  // discord
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#5865F2">
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

interface ShareRoomModalProps {
  open: boolean;
  onClose: () => void;
  roomCode: string;
  roomName?: string;
}

export function ShareRoomModal({
  open,
  onClose,
  roomCode,
  roomName,
}: ShareRoomModalProps) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/salas-de-foco?join=${roomCode}`
      : `/salas-de-foco?join=${roomCode}`;

  const message = roomName
    ? `Venha focar comigo em ${roomName}! Código: ${roomCode}`
    : `Venha focar comigo em uma Sala de Foco! Código: ${roomCode}`;

  const copy = useCallback(async (kind: "code" | "link", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  }, []);

  const combinedClass =
    "flex items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] py-3 text-sm text-[var(--text)] transition-colors hover:bg-[var(--bg-surface)]";

  return (
    <Modal open={open} onClose={onClose} variant="bottom-sheet" panelClassName="rounded-t-3xl sm:rounded-3xl">
      <div className="p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-lg">Convidar para a sala</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            aria-label="Fechar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-[var(--text-faint)] mb-4">
          Compartilhe o código para focarem juntos
        </p>

        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3 flex items-center gap-3 mb-4">
          <Link2 size={16} className="shrink-0 text-[var(--text-muted)]" />
          <span className="flex-1 text-[12px] font-mono text-[var(--text)] truncate">{joinUrl}</span>
          <button
            onClick={() => copy("link", joinUrl)}
            className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            {copied === "link" ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            {copied === "link" ? "Copiado" : "Copiar link"}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {PLATFORMS.map((p, i) => (
            <motion.a
              key={p.id}
              href={p.build(joinUrl, message)}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] py-3.5"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <PlatformIcon name={p.icon} />
              <span className="text-[10px] text-[var(--text-muted)]">{p.label}</span>
            </motion.a>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => copy("code", roomCode)}
            className={combinedClass}
          >
            {copied === "code" ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            {copied === "code" ? "Código copiado!" : `Copiar código`}
          </button>
          <button
            onClick={async () => {
              if (typeof navigator !== "undefined" && navigator.share) {
                try {
                  await navigator.share({ title: "Sala de Foco", text: message, url: joinUrl });
                  return;
                } catch {
                  /* fall through */
                }
              }
              await copy("link", joinUrl);
            }}
            className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, var(--accent), var(--orange))" }}
          >
            <Share2 size={16} /> Mais opções
          </button>
        </div>
      </div>
    </Modal>
  );
}
