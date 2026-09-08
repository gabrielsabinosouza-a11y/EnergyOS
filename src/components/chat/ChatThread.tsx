"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDown,
  Check,
  CheckCheck,
  Copy,
  Pin,
  MessageCircleReply,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import type { ChatMessage, PinDurationDays } from "@/types";
import { AvatarWithFrame } from "@/components/avatar";

/* ─── Helpers ──────────────────────────────────────────────────────── */

function formatClock(iso?: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function fmtDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** "expira em 7 dias" / "expira hoje" for a pinned-until timestamp. */
function formatPinExpiry(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expira hoje";
  const days = Math.ceil(ms / 86_400_000);
  return days <= 1 ? "expira hoje" : `expira em ${days} dias`;
}

/** Returns true if two ISO dates are on different days (in the user's timezone). */
function differentDays(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() !== db.getFullYear() ||
    da.getMonth() !== db.getMonth() ||
    da.getDate() !== db.getDate()
  );
}

/* ─── @mention rendering ─────────────────────────────────────────── */

export interface MentionMember {
  id: string;
  displayName: string;
  username?: string;
}

/** Render message text, highlighting "@handle" tokens that exactly match a
 *  member (groups only — pass `mentionMembers`). Non-matching "@" text (e.g.
 *  email prefixes or casual use) stays plain. DMs pass no members → plain. */
function MentionText({
  text,
  members,
  isMe,
}: {
  text: string;
  members: MentionMember[];
  isMe: boolean;
}) {
  const parts = useMemo(() => text.split(/(@[^\s]+)/g), [text]);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const token = part.slice(1);
        const stripped = token.replace(/[.,;:!?…"'()\[\]{}]+$/, "");
        const isEveryone = stripped.toLowerCase() === "everyone";
        const isMember = !isEveryone && stripped.length > 0 && members.some(
          (m) =>
            (m.username ?? "").toLowerCase() === stripped.toLowerCase() ||
            m.displayName.toLowerCase() === stripped.toLowerCase(),
        );
        if (!isMember && !isEveryone) return <Fragment key={i}>{part}</Fragment>;
        const trailing = token.slice(stripped.length);
        return (
          <Fragment key={i}>
            <span
              className={
                isEveryone
                  ? "rounded bg-[#c44dff]/15 px-1 font-medium text-[#c44dff]"
                  : isMe
                    ? "rounded bg-black/10 px-1 font-medium text-black/80"
                    : "rounded bg-[var(--accent-bg)] px-1 font-medium text-[var(--accent)]"
              }
            >
              @{stripped}
            </span>
            {trailing}
          </Fragment>
        );
      })}
    </>
  );
}

/** Format a date for the divider label, e.g. "8 de setembro" */
const MONTH_NAMES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
function formatDateDivider(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return `${d.getDate()} de ${MONTH_NAMES_PT[d.getMonth()]}`;
}

/* ─── UserAvatar (inline) ─────────────────────────────────────────── */

/* ─── Status indicators ────────────────────────────────────────────── */

function CheckMark({ read }: { read?: boolean }) {
  return read ? (
    <CheckCheck size={13} className="text-[var(--accent)]" />
  ) : (
    <Check size={13} className="text-current opacity-50" />
  );
}

/* ─── Context menu ─────────────────────────────────────────────────── */

interface ContextMenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "danger";
  hidden?: boolean;
  keepOpen?: boolean;
}

function ContextMenu({
  x,
  y,
  actions,
  reactions,
  onClose,
}: {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  reactions?: { onSelect: (emoji: string) => void };
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
        className="fixed min-w-[160px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1 shadow-2xl backdrop-blur-xl"
        style={{ left: pos.x, top: pos.y }}
      >
        {reactions && (
          <>
            <div className="flex items-center justify-center gap-1 border-b border-[var(--border-subtle)] px-2 pb-1.5">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    reactions.onSelect(emoji);
                    onClose();
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:bg-[var(--accent-bg)]"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="p-1" />
          </>
        )}
        {actions
          .filter((a) => !a.hidden)
          .map((action, i) => (
            <button
              key={i}
              onClick={() => {
                action.onClick();
                if (!action.keepOpen) onClose();
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

/* ─── Reply preview (above input) ──────────────────────────────────── */

function ReplyPreview({
  message,
  onCancel,
}: {
  message: ChatMessage;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-2 overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/60 px-4 py-2"
    >
      <MessageCircleReply size={14} className="shrink-0 text-[var(--accent)]" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-[var(--accent)]">
          Respondendo {message.senderName ?? "mensagem"}
        </p>
        <p className="truncate text-xs text-[var(--text-muted)]">
          {message.body ?? " mídia"}
        </p>
      </div>
      <button
        onClick={onCancel}
        className="shrink-0 rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

/* ─── Date divider ─────────────────────────────────────────────────── */

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="h-px flex-1 bg-[var(--border-subtle)]" />
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
        {label}
      </span>
      <div className="h-px flex-1 bg-[var(--border-subtle)]" />
    </div>
  );
}

/* ─── "Old messages" pill ──────────────────────────────────────────── */

function NewMessagesPill({ count, onClick }: { count: number; onClick: () => void }) {
  const label =
    count > 1
      ? `${count} novas mensagens — voltar para as recentes`
      : count === 1
        ? "1 nova mensagem — voltar para as recentes"
        : "Você está vendo mensagens antigas — voltar para as recentes";

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      onClick={onClick}
      className="absolute bottom-3 left-1/2 z-20 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-[11px] font-medium text-black shadow-lg transition hover:brightness-110"
    >
      <ArrowDown size={12} className="shrink-0" />
      <span className="truncate">{label}</span>
    </motion.button>
  );
}

/* ─── Message bubble ───────────────────────────────────────────────── */

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

function MessageBubble({
  msg,
  isMe,
  showAvatar,
  showSenderName,
  reduced,
  onContextMenu,
  read,
  onReaction,
  onQuoteClick,
  showActionTrigger,
  onActionTrigger,
  mentionMembers,
}: {
  msg: ChatMessage;
  isMe: boolean;
  showAvatar: boolean;
  showSenderName: boolean;
  reduced: boolean;
  onContextMenu: (e: React.MouseEvent, msg: ChatMessage) => void;
  read?: boolean;
  onReaction: (messageId: number, emoji: string) => void;
  onQuoteClick: (messageId: number) => void;
  /** Whether the ⋯ trigger should be shown (row is hovered). */
  showActionTrigger: boolean;
  /** Click on the ⋯ trigger (opens the context menu anchored to this bubble). */
  onActionTrigger: (e: React.MouseEvent) => void;
  /** Group members for @mention rendering (DMs pass nothing → plain text). */
  mentionMembers?: MentionMember[];
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const reactions = msg.reactions ?? [];
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onContextMenu(e, msg);
    },
    [msg, onContextMenu],
  );
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLongPress = useCallback((e: React.TouchEvent) => {
    longPressRef.current = setTimeout(() => {
      const touch = e.touches[0];
      onContextMenu({ clientX: touch.clientX, clientY: touch.clientY } as React.MouseEvent, msg);
    }, 500);
  }, [msg, onContextMenu]);

  const cancelLongPress = useCallback(() => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  }, []);

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}
    >
      {showAvatar && !isMe && (
        <div className="mt-0.5 shrink-0">
          <AvatarWithFrame name={msg.senderName} photoUrl={msg.senderPhotoUrl} size={32} />
        </div>
      )}
      <div
        className={`max-w-[75%] ${showAvatar ? "" : isMe ? "ml-[42px]" : "mr-[42px]"} ${
          isMe ? "items-end" : "items-start"
        } flex flex-col`}
      >
        {showSenderName && !isMe && (
          <p className="mb-0.5 text-[10px] font-medium text-[var(--text-muted)]">
            {msg.senderName}
          </p>
        )}

        {/* Bubble — wrapped in a shrink-to-fit relative container so the ⋯
            trigger anchors to the bubble's own edge (never the row edge). */}
        <div className="relative">
          <div
            onContextMenu={handleContextMenu}
            className={`group relative cursor-pointer overflow-hidden rounded-2xl transition ${
              isMe ? "rounded-br-md bg-[var(--accent)]" : "glass-card rounded-bl-md"
            }`}
            onTouchStart={startLongPress}
            onTouchEnd={cancelLongPress}
            onTouchMove={cancelLongPress}
          >
          {/* Compact reply quote (WhatsApp style, contained inside this bubble) */}
          {msg.replyToBody && (
            <button
              type="button"
              onClick={() => msg.replyToId && onQuoteClick(msg.replyToId)}
              className={`mx-2 mt-2 flex max-w-[88%] items-center gap-1.5 rounded-md border-l-[3px] px-2 py-1 text-left transition ${
                isMe
                  ? "border-white/50 bg-black/10 hover:bg-black/20"
                  : "border-[var(--accent)]/60 bg-[var(--accent-bg)] hover:bg-[var(--accent-bg)]/70"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-[11px] font-semibold ${
                    isMe ? "text-black/70" : "text-[var(--accent)]"
                  }`}
                >
                  {msg.replyToSenderName ?? "mensagem"}
                </p>
                <p
                  className={`truncate text-[11px] ${
                    isMe ? "text-black/60" : "text-[var(--text-muted)]"
                  }`}
                >
                  {msg.replyToBody}
                </p>
              </div>
            </button>
          )}

          {/* Media content */}
          {msg.messageType === "IMAGE" && msg.mediaUrl && (
            <button type="button" onClick={() => setLightboxOpen(true)} className="block">
            <img
              src={msg.mediaUrl}
              alt="imagem"
              className="max-h-72 w-full object-cover"
            />
            </button>
          )}
          {msg.messageType === "VIDEO" && msg.mediaUrl && (
            <video
              src={msg.mediaUrl}
              controls
              className="max-h-72 w-full object-cover"
            />
          )}
          {msg.messageType === "AUDIO" && msg.mediaUrl && (
            <div className="px-3 py-2">
              <div className="mb-1 flex items-center gap-1" aria-hidden="true">
                {Array.from({ length: 24 }, (_, i) => <span key={i} className="w-1 rounded-full bg-current opacity-60" style={{ height: `${8 + ((i * 13) % 18)}px` }} />)}
              </div>
              <audio src={msg.mediaUrl} controls className="w-64 max-w-full" />
              {msg.mediaDurationSeconds != null && (
                <p
                  className={`mt-0.5 text-[9px] ${
                    isMe ? "text-black/70" : "text-[var(--text-faint)]"
                  }`}
                >
                  {fmtDuration(msg.mediaDurationSeconds)}
                </p>
              )}
            </div>
          )}
          {msg.messageType === "DOCUMENT" && msg.mediaUrl && (
            <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className={`flex items-center gap-2 px-3 py-3 text-sm ${isMe ? "text-black" : "text-[var(--text)]"}`}>
              <span className="rounded bg-black/10 px-2 py-1 text-xs">DOC</span>
              <span className="max-w-56 truncate">{msg.mediaFileName ?? "Documento"}</span>
            </a>
          )}
          {lightboxOpen && msg.mediaUrl && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-6" onClick={() => setLightboxOpen(false)}>
              <img src={msg.mediaUrl} alt="imagem ampliada" className="max-h-full max-w-full object-contain" />
            </div>
          )}
          {msg.messageType === "STICKER" && (
            <div className="px-3 py-2 text-5xl leading-none">
              {msg.body || msg.mediaUrl}
            </div>
          )}

          {/* Text body */}
          {(msg.body && msg.messageType !== "STICKER") ||
          !msg.messageType ||
          msg.messageType === "TEXT" ? (
            <div
              className={`px-4 py-2.5 text-sm leading-relaxed ${
                isMe ? "text-black" : "text-[var(--text)]"
              }`}
            >
              {mentionMembers?.length
                ? <MentionText text={msg.body ?? ""} members={mentionMembers} isMe={isMe} />
                : msg.body}
            </div>
          ) : null}
          </div>

          {/* Floating action trigger: anchored to THIS bubble's outer edge —
              left of own (right-aligned) bubbles, right of others' bubbles —
              shown on hover of the row (desktop). Rendered as a sibling of
              the bubble (not inside it) so overflow-hidden can't clip it. */}
          {showActionTrigger && (
            <button
              type="button"
              onClick={onActionTrigger}
              aria-label="Ações da mensagem"
              className={`absolute top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/10 text-current backdrop-blur-sm transition hover:bg-black/20 sm:flex ${
                isMe ? "right-full mr-1" : "left-full ml-1"
              }`}
            >
              <span className="text-[10px]">⋯</span>
            </button>
          )}
        </div>

        {reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 ${isMe ? "justify-end" : ""}`}>
            {reactions.map((reaction) => (
              <button
                type="button"
                key={reaction.emoji}
                onClick={() => onReaction(msg.id, reaction.emoji)}
                title={reaction.userNames.join(", ")}
                className={`rounded-full border px-1.5 py-0.5 text-[11px] ${
                  reaction.reactedByMe
                    ? "border-[var(--accent)] bg-[var(--accent-bg)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
                }`}
              >
                {reaction.emoji} {reaction.count}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp + status */}
        <div
          className={`mt-0.5 flex items-center gap-1 ${
            isMe ? "flex-row-reverse" : ""
          }`}
        >
          <p className="text-[9px] text-[var(--text-faint)]">
            {formatClock(msg.createdAt)}
            {msg.editedAt && " (editada)"}
          </p>
          {msg.pending && <span className="text-[9px] italic text-[var(--text-faint)]">enviando…</span>}
          {isMe && !msg.pending && <CheckMark read={read} />}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main ChatThread component ────────────────────────────────────── */

const SCROLL_BOTTOM_THRESHOLD = 150;

export interface ChatThreadProps {
  messages: ChatMessage[];
  currentUserId: string;
  reduced: boolean;
  showAvatar?: boolean;
  showSenderName?: boolean;

  /* Scroll-to-bottom-override for newly arriving messages */
  onSend?: (body: string) => Promise<void>;
  onCopy?: (text: string) => void;
  onReply?: (body: string, replyToId: number) => Promise<void>;
  onEdit?: (messageId: number, newBody: string) => Promise<void>;
  onDelete?: (messageId: number) => Promise<void>;
  onReact?: (messageId: number, emoji: string) => Promise<void>;
  onTogglePin?: (messageId: number, durationDays?: PinDurationDays) => Promise<void>;

  /** Authoritative pinned list (up to 3, server-filtered for expiry). When
   *  omitted, falls back to messages flagged isPinned (single-pin DM chats). */
  pinnedMessages?: ChatMessage[];

  /** Sender roles whose messages the CURRENT user may delete (moderation).
   *  Own messages are always deletable regardless. Only used for groups. */
  deleteSenderRoles?: import("@/types").GroupRole[];

  /** Members for @mention rendering. When provided, "@handle" tokens matching
   *  a member are highlighted in the message body. DMs omit this → plain. */
  mentionMembers?: MentionMember[];

  /** Read status tracking: message IDs that the other party has read */
  readMessageIds?: Set<number>;

  /** Custom input area (for group-specific features like media, voice) */
  inputSlot?: React.ReactNode;

  /** External reply state */
  replyingTo?: ChatMessage | null;
  onCancelReply?: () => void;
  /** Called when the user picks "Reply" in a message's context menu */
  onReplyMessage?: (msg: ChatMessage) => void;

  /** Called when a new message arrives while scrolled up */
  onNewMessagesClick?: () => void;
}

export function ChatThread({
  messages,
  currentUserId,
  reduced,
  showAvatar = false,
  showSenderName = false,
  onSend,
  onCopy,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onTogglePin,
  pinnedMessages,
  readMessageIds,
  inputSlot,
  replyingTo,
  onCancelReply,
  onReplyMessage,
  onNewMessagesClick,
  deleteSenderRoles,
  mentionMembers,
}: ChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const prevCountRef = useRef(messages.length);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    msg: ChatMessage;
  } | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [busyReaction, setBusyReaction] = useState<string | null>(null);
  const [busyPinId, setBusyPinId] = useState<number | null>(null);
  const [pinPickerFor, setPinPickerFor] = useState<number | null>(null);
  const messageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const initialScrollDoneRef = useRef(false);
  // Set true the moment the user deliberately scrolls away from the bottom
  // (reading history); the initial force-pin stops while it's true.
  const userScrolledUpRef = useRef(false);
  // Banner pins: prefer the authoritative server list (covers messages older
  // than the fetched window); fall back to in-list flags for DM chats.
  const pinnedList = useMemo(
    () => pinnedMessages ?? messages.filter((message) => message.isPinned).slice(0, 3),
    [pinnedMessages, messages],
  );

  /* ─── Scroll management ────────────────────────────────────────── */

  // Detect if near bottom on scroll. Sets userScrolledUpRef so the initial
  // force-pin stops the moment the user starts reading history.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distFromBottom < SCROLL_BOTTOM_THRESHOLD;
    setIsNearBottom(near);
    if (near) setPendingCount(0);
    // "instant" scrolls never fire a scroll event with a big enough delta, so
    // use a small dead-zone to tell deliberate scrolls apart.
    userScrolledUpRef.current = !near && el.scrollTop > 0;
  }, []);

  // Scroll to bottom (imperative). Using direct scrollTop assignment for the
  // instant case is the most reliable way to land on the newest messages.
  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    const doScroll = () => {
      if (smooth) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    };
    // Double rAF: first lets layout for newly-rendered messages finish, second
    // guarantees the browser has the final scrollHeight before we set scrollTop.
    requestAnimationFrame(() => requestAnimationFrame(doScroll));
  }, []);

  // Pin the viewport to the newest message when the chat opens. The list loads
  // asynchronously and late-rendering media changes the scroll height, so keep
  // force-pinning until the container stops growing — up to ~3.6s after the
  // conversation opens. The latch resets whenever a *different* conversation is
  // opened (signalled by a change in the first message id), so switching
  // friends/groups always drops the user straight to the newest messages
  // instead of leaving them stranded on the old ones.
  const firstMsgId = messages.length > 0 ? messages[0].id : undefined;
  const prevFirstIdRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (messages.length === 0) return;
    if (firstMsgId !== prevFirstIdRef.current) {
      prevFirstIdRef.current = firstMsgId;
      initialScrollDoneRef.current = false;
    }
    if (initialScrollDoneRef.current) return;

    const el = scrollRef.current;
    if (!el) return;
    let retries = 30;
    let lastHeight = -1;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const pin = () => {
      if (!el || retries-- <= 0 || userScrolledUpRef.current) {
        initialScrollDoneRef.current = true;
        return;
      }
      el.scrollTop = el.scrollHeight;
      // Keep pinning while the content height is still settling (media loads).
      if (el.scrollHeight !== lastHeight) {
        lastHeight = el.scrollHeight;
        timer = setTimeout(pin, 120);
      } else {
        initialScrollDoneRef.current = true;
      }
    };
    pin();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [firstMsgId, messages.length]);

  // Track new messages
  useEffect(() => {
    const delta = messages.length - prevCountRef.current;
    prevCountRef.current = messages.length;

    if (delta > 0) {
      if (isNearBottom) {
        scrollToBottom(true);
      } else {
        setPendingCount((c) => c + delta);
      }
    }
  }, [messages.length, isNearBottom, scrollToBottom]);

  // Clicking pill scrolls down
  const handlePillClick = useCallback(() => {
    setPendingCount(0);
    scrollToBottom(true);
    onNewMessagesClick?.();
  }, [scrollToBottom, onNewMessagesClick]);

  const toggleReaction = useCallback(async (messageId: number, emoji: string) => {
    if (!onReact) return;
    const key = `${messageId}:${emoji}`;
    if (busyReaction === key) return;
    setBusyReaction(key);
    try {
      await onReact(messageId, emoji);
    } finally {
      setBusyReaction(null);
    }
  }, [busyReaction, onReact]);

  const togglePin = useCallback(async (message: ChatMessage, durationDays?: PinDurationDays) => {
    if (!onTogglePin || busyPinId === message.id) return;
    setBusyPinId(message.id);
    try {
      await onTogglePin(message.id, durationDays);
    } finally {
      setBusyPinId(null);
    }
  }, [busyPinId, onTogglePin]);

  const jumpToMessage = useCallback((messageId: number) => {
    messageRefs.current[messageId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  /* ─── Message actions ──────────────────────────────────────────── */

  const handleContextMenuAction = useCallback(
    (action: string, msg: ChatMessage) => {
      switch (action) {
        case "copy": {
          const text = msg.body ?? "";
          if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
          }
          onCopy?.(text);
          break;
        }
        case "reply":
          // Handled externally via onReply prop
          break;
        case "edit":
          setEditingId(msg.id);
          setEditText(msg.body ?? "");
          break;
        case "delete":
          onDelete?.(msg.id);
          break;
        case "pin":
          setPinPickerFor(msg.id);
          break;
      }
    },
    [onCopy, onDelete],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, msg: ChatMessage) => {
      setContextMenu({ x: e.clientX, y: e.clientY, msg });
    },
    [],
  );

  /* ─── Send / edit ──────────────────────────────────────────────── */

  const handleSend = useCallback(async () => {
    const body = input.trim();
    if (!body || sending) return;

    if (editingId !== null) {
      setInput("");
      setSending(true);
      try {
        await onEdit?.(editingId, body);
      } catch {
        setInput(body);
      } finally {
        setSending(false);
        setEditingId(null);
      }
      return;
    }

    setInput("");
    setSending(true);
    try {
      if (replyingTo && onReply) {
        await onReply(body, replyingTo.id);
      } else {
        await onSend?.(body);
      }
    } catch {
      setInput(body);
    } finally {
      setSending(false);
    }
  }, [input, sending, editingId, onEdit, replyingTo, onReply, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape" && editingId !== null) {
        setEditingId(null);
        setInput("");
      }
    },
    [handleSend, editingId],
  );

  /* ─── Context menu actions ─────────────────────────────────────── */

  const contextMenuActions = useMemo(() => {
    if (!contextMenu) return [];
    const msg = contextMenu.msg;
    const isMe = msg.senderId === currentUserId;

    // Pin duration picker mode: replaces the menu while choosing 7/14/30 days.
    if (pinPickerFor === msg.id) {
      return [
        {
          label: "Fixar por 7 dias",
          icon: <Pin size={14} />,
          onClick: () => void togglePin(msg, 7),
        },
        {
          label: "Fixar por 14 dias",
          icon: <Pin size={14} />,
          onClick: () => void togglePin(msg, 14),
        },
        {
          label: "Fixar por 30 dias",
          icon: <Pin size={14} />,
          onClick: () => void togglePin(msg, 30),
        },
        {
          label: "Cancelar",
          icon: <X size={14} />,
          onClick: () => setPinPickerFor(null),
        },
      ];
    }

    return [
      {
        label: "Copiar",
        icon: <Copy size={14} />,
        onClick: () => handleContextMenuAction("copy", msg),
        hidden: !msg.body,
      },
      {
        label: "Responder",
        icon: <MessageCircleReply size={14} />,
        onClick: () => onReplyMessage?.(msg),
      },
      {
        label: msg.isPinned ? "Desafixar" : "Fixar mensagem",
        icon: <Pin size={14} />,
        onClick: () => {
          if (msg.isPinned) void togglePin(msg);
          else setPinPickerFor(msg.id);
        },
        hidden: !onTogglePin,
        keepOpen: !msg.isPinned,
      },
      {
        label: "Editar",
        icon: <Pencil size={14} />,
        onClick: () => handleContextMenuAction("edit", msg),
        hidden: !isMe,
      },
      {
        label: "Apagar",
        icon: <Trash2 size={14} />,
        onClick: () => handleContextMenuAction("delete", msg),
        variant: "danger" as const,
        hidden: !isMe && !(deleteSenderRoles?.includes(msg.senderRole as import("@/types").GroupRole)),
      },
    ];
  }, [contextMenu, pinPickerFor, currentUserId, handleContextMenuAction, onReplyMessage, onTogglePin, togglePin, deleteSenderRoles]);

  /* ─── Render ───────────────────────────────────────────────────── */

  // Group messages by date for dividers
  const messagesWithDividers = useMemo(() => {
    const items: (
      | { type: "divider"; key: string; label: string }
      | { type: "message"; key: string; msg: ChatMessage; prevMsg: ChatMessage | null }
    )[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const prevMsg = i > 0 ? messages[i - 1] : null;

      // Insert date divider if different day
      if (i === 0 || (prevMsg && differentDays(prevMsg.createdAt, msg.createdAt))) {
        items.push({
          type: "divider",
          key: `divider-${msg.createdAt}`,
          label: formatDateDivider(msg.createdAt),
        });
      }

      items.push({ type: "message", key: `msg-${msg.id}`, msg, prevMsg });
    }

    return items;
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      {/* Pinned messages banner (up to 3; expired pins filtered server-side) */}
      {pinnedList.length > 0 && (
        <div className="mx-3 mt-3 mb-1 space-y-2 rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent-bg)]/40 p-3 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
            <Pin size={14} className="shrink-0" />
            Mensagens fixadas
          </div>
          {pinnedList.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 px-3 py-2.5 shadow-sm"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                <Pin size={16} className="fill-current" />
              </span>
              <button
                type="button"
                onClick={() => jumpToMessage(p.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-medium text-[var(--text)] hover:text-[var(--accent)]">
                  {p.body ?? "Mídia"}
                </span>
                {p.senderName && (
                  <span className="block truncate text-[11px] text-[var(--text-muted)]">
                    {p.senderName}
                  </span>
                )}
              </button>
              {p.pinnedUntil && (
                <span className="shrink-0 rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                  {formatPinExpiry(p.pinnedUntil)}
                </span>
              )}
              {onTogglePin && (
                <button
                  type="button"
                  onClick={() => void togglePin(p)}
                  disabled={busyPinId === p.id}
                  aria-label="Desafixar"
                  className="shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--text)] disabled:opacity-40"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Scrollable messages area */}
      <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full space-y-3 overflow-y-auto px-5 py-4 sm:px-8 lg:px-12"
      >
        {messages.length === 0 && (
          <p className="pt-12 text-center text-xs text-[var(--text-faint)]">
            Nenhuma mensagem ainda
          </p>
        )}

        {messagesWithDividers.map((item) => {
          if (item.type === "divider") {
            return <DateDivider key={item.key} label={item.label} />;
          }

          const { msg, prevMsg } = item;
          const isMe = msg.senderId === currentUserId;

          // Show avatar+name for first message or after a short sequence gap.
          const isFirstInGroup =
            !prevMsg ||
            prevMsg.senderId !== msg.senderId ||
            (prevMsg && new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 5 * 60_000) ||
            (prevMsg && differentDays(prevMsg.createdAt, msg.createdAt));

          // If we're editing this message inline
          if (editingId === msg.id) {
            return (
              <div key={item.key} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className="glass-card w-full max-w-[75%] rounded-2xl px-3 py-2">
                  <p className="mb-1 text-[10px] font-medium text-[var(--accent)]">
                    Editando mensagem
                  </p>
                  <textarea
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        onEdit?.(msg.id, editText.trim()).then(() => {
                          setEditingId(null);
                          setEditText("");
                        });
                      }
                      if (e.key === "Escape") {
                        setEditingId(null);
                        setEditText("");
                      }
                    }}
                    className="w-full resize-none bg-transparent text-sm text-[var(--text)] outline-none"
                    rows={2}
                  />
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => { setEditingId(null); setEditText(""); }}
                      className="rounded px-2 py-0.5 text-[10px] text-[var(--text-muted)] hover:bg-[var(--accent-bg)]"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => {
                        onEdit?.(msg.id, editText.trim()).then(() => {
                          setEditingId(null);
                          setEditText("");
                        });
                      }}
                      className="rounded bg-[var(--accent)] px-2 py-0.5 text-[10px] font-medium text-black"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={item.key}
              ref={(node) => { messageRefs.current[msg.id] = node; }}
              onMouseEnter={() => setHoveredId(msg.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="group/message relative"
            >
            <MessageBubble
              msg={msg}
              isMe={isMe}
              showAvatar={showAvatar ? isFirstInGroup : false}
              showSenderName={showSenderName ? isFirstInGroup : false}
              reduced={reduced}
              onContextMenu={handleContextMenu}
              read={readMessageIds?.has(msg.id)}
              onReaction={toggleReaction}
              onQuoteClick={jumpToMessage}
              showActionTrigger={hoveredId === msg.id}
              onActionTrigger={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                handleContextMenu(
                  { clientX: rect.right, clientY: rect.bottom + 4 } as React.MouseEvent,
                  msg,
                );
              }}
              mentionMembers={mentionMembers}
            />
            </div>
          );
        })}
      </div>

        {/* "Novas mensagens / mensagens antigas" pill */}
        <AnimatePresence>
          {!isNearBottom && (
            <NewMessagesPill count={pendingCount} onClick={handlePillClick} />
          )}
        </AnimatePresence>
      </div>

      {/* Reply preview */}
      <AnimatePresence>
        {replyingTo && (
          <ReplyPreview message={replyingTo} onCancel={() => onCancelReply?.()} />
        )}
      </AnimatePresence>

      {/* Editing indicator */}
      <AnimatePresence>
        {editingId !== null && !replyingTo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/60 px-4 py-2"
          >
            <Pencil size={14} className="shrink-0 text-[var(--accent)]" />
            <span className="text-xs text-[var(--text-muted)]">Editando mensagem</span>
            <button
              onClick={() => { setEditingId(null); setEditText(""); }}
              className="ml-auto rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      {inputSlot ?? (
        <div className="border-t border-[var(--border-subtle)] px-5 py-3 backdrop-blur-lg sm:px-8 lg:px-12">
          <div className="glass-card flex items-center gap-1.5 px-2 py-2">
            <input
              type="text"
              placeholder={
                editingId !== null
                  ? "Editar mensagem..."
                  : replyingTo
                    ? "Responder..."
                    : "Mensagem..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none"
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && editingId === null) || sending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-black transition hover:brightness-110 disabled:opacity-30"
            >
              {sending ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22 11 13 2 9Z" /></svg>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Context menu portal */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextMenuActions}
          reactions={
            onReact && pinPickerFor !== contextMenu.msg.id
              ? {
                  onSelect: (emoji) => void toggleReaction(contextMenu.msg.id, emoji),
                }
              : undefined
          }
          onClose={() => {
            setContextMenu(null);
            setPinPickerFor(null);
          }}
        />
      )}
    </div>
  );
}
