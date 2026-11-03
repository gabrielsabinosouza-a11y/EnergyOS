"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Image as ImageIcon,
  FileText,
  Loader2,
  Megaphone,
  Paperclip,
  Send,
} from "lucide-react";
import { validateImageFile, validateMediaSize, uploadToCloudinary } from "@/lib/media";
import type { DirectMessageType } from "@/types";

/* ─── Types ───────────────────────────────────────────────────────── */

export interface ChatComposerMentionMember {
  id: string;
  displayName: string;
  username?: string;
  photoUrl?: string;
}

export interface ChatComposerProps {
  /** Persist a text send (DM or group). Page decides reply vs plain send. */
  onSendText: (body: string) => Promise<void>;
  /** Persist a media send (IMAGE/DOCUMENT). */
  onSendMedia: (opts: {
    messageType: DirectMessageType;
    mediaUrl?: string;
    body?: string;
    mediaDurationSeconds?: number;
    mediaFileName?: string;
    mediaMimeType?: string;
    mediaSizeBytes?: number;
  }) => Promise<void>;
  /** Set while a reply is active (swaps the input placeholder). */
  replying?: boolean;
  /** External error line (page-level failures), rendered above the composer. */
  error?: string | null;
  /** When provided, "@" autocomplete over these members is enabled (groups). */
  mentionMembers?: ChatComposerMentionMember[];
  /** Current user id (excluded from mention results when provided). */
  currentUserId?: string;
}

function MentionAvatar({ member, size = 26 }: { member: ChatComposerMentionMember; size?: number }) {
  if (member.id === "everyone") {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full text-[var(--white)]"
        style={{
          width: size,
          height: size,
          background: "linear-gradient(135deg, #ff8a5c, #c44dff)",
        }}
      >
        <Megaphone size={Math.round(size * 0.6)} />
      </span>
    );
  }
  if (member.photoUrl) {
    return (
      <img
        src={member.photoUrl}
        alt={member.displayName}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-bold text-black"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #71d4ff, #b69cff)",
      }}
    >
      {member.displayName.charAt(0).toUpperCase()}
    </div>
  );
}

/* ─── ChatComposer ────────────────────────────────────────────────── */

/**
 * Shared message composer used as ChatThread's `inputSlot` by
 * BOTH the DM (Amigos) and group (Grupos) chats. Supports text, images,
 * and documents. Group-only @mention autocomplete is enabled
 * via the optional `mentionMembers` prop.
 */
export function ChatComposer({
  onSendText,
  onSendMedia,
  replying = false,
  error = null,
  mentionMembers,
  currentUserId,
}: ChatComposerProps) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionOpen, setMentionOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const sendText = useCallback(
    async (raw: string) => {
      const body = raw.trim();
      if (!body || busy) return;
      setInput("");
      setLocalError(null);
      setBusy(true);
      try {
        await onSendText(body);
      } catch {
        setInput(raw);
        setLocalError("Não foi possível enviar a mensagem.");
      } finally {
        setBusy(false);
      }
    },
    [busy, onSendText],
  );

  /** Set busy while persisting; rethrows so callers surface a friendly error. */
  async function pushMedia(opts: {
    messageType: DirectMessageType;
    mediaUrl?: string;
    body?: string;
    mediaDurationSeconds?: number;
    mediaFileName?: string;
    mediaMimeType?: string;
    mediaSizeBytes?: number;
  }) {
    setBusy(true);
    setLocalError(null);
    try {
      await onSendMedia(opts);
    } finally {
      setBusy(false);
    }
  }

  async function handleSendImage(file: File) {
    if (uploadingMedia || busy) return;
    setUploadingMedia(true);
    setLocalError(null);
    try {
      validateImageFile(file);
      const { secureUrl } = await uploadToCloudinary(file, setUploadProgress);
      await pushMedia({ messageType: "IMAGE", mediaUrl: secureUrl, mediaFileName: file.name, mediaMimeType: file.type, mediaSizeBytes: file.size });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploadingMedia(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) await handleSendImage(file);
    else if (
      file.type === "application/pdf" ||
      file.type.startsWith("text/") ||
      file.type.includes("word") ||
      file.type.includes("excel") ||
      file.type.includes("spreadsheet") ||
      file.type === "application/zip" ||
      file.type === "application/x-zip-compressed" ||
      /\.(pdf|doc|docx|xls|xlsx|zip|txt|csv)$/i.test(file.name)
    ) await handleSendDocument(file);
    else setLocalError("Formato de arquivo não suportado.");
  }

  async function handleSendDocument(file: File) {
    if (uploadingMedia || busy) return;
    setUploadingMedia(true); setUploadProgress(0); setLocalError(null);
    try {
      validateMediaSize(file);
      const { secureUrl } = await uploadToCloudinary(file, setUploadProgress);
      await pushMedia({ messageType: "DOCUMENT", mediaUrl: secureUrl, mediaFileName: file.name, mediaMimeType: file.type, mediaSizeBytes: file.size });
    } catch (error) { setLocalError(error instanceof Error ? error.message : "Não foi possível enviar o arquivo."); }
    finally { setUploadingMedia(false); setUploadProgress(0); if (fileRef.current) fileRef.current.value = ""; }
  }

  /* ─── @mention autocomplete (groups only) ──────────────────────── */

  const mentionEnabled = Boolean(mentionMembers?.length);
  const lastSpaceIdx = input.lastIndexOf(" ");
  const activeWord = input.slice(lastSpaceIdx + 1);

  const mentionQuery = mentionEnabled && activeWord.startsWith("@") ? activeWord.slice(1) : null;

  const mentionResults = useMemo(() => {
    if (mentionQuery === null || !mentionMembers) return [];
    const q = mentionQuery.toLowerCase();
    const everyone: ChatComposerMentionMember[] =
      !q || "everyone".startsWith(q)
        ? [{ id: "everyone", displayName: "everyone", username: "everyone" }]
        : [];
    const matches = mentionMembers.filter(
      (m) =>
        m.id !== currentUserId &&
        (!q || (m.username ?? "").toLowerCase().includes(q) || m.displayName.toLowerCase().includes(q)),
    );
    const score = (m: ChatComposerMentionMember) => {
      if (q && (m.username ?? "").toLowerCase().startsWith(q)) return 2;
      if (q && m.displayName.toLowerCase().startsWith(q)) return 1;
      return 0;
    };
    return everyone.length > 0
      ? [...everyone, ...matches]
          .sort((a, b) => score(b) - score(a) || a.displayName.localeCompare(b.displayName))
          .slice(0, 8)
      : matches
          .sort((a, b) => score(b) - score(a) || a.displayName.localeCompare(b.displayName))
          .slice(0, 8);
  }, [mentionQuery, mentionMembers, currentUserId]);

  function insertMention(m: ChatComposerMentionMember) {
    const handle = m.username ?? m.displayName;
    const prefix = lastSpaceIdx >= 0 ? input.slice(0, lastSpaceIdx + 1) : "";
    setInput(`${prefix}@${handle} `);
    setMentionOpen(false);
    setMentionIndex(0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (mentionResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionResults.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionResults[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionOpen(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendText(input);
    }
  }

  const shownError = error ?? localError;

  useEffect(() => {
    const textarea = textAreaRef.current;
    if (!textarea) return;
    const maxHeight = 80;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [input]);

  return (
    <div className="chat-composer-shell flex-none border-t border-white/[.06] bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/95 to-[var(--bg)]/75 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-xl sm:px-8 lg:px-12">
      {shownError && <p className="mb-2 text-[11px] text-[var(--red)]">{shownError}</p>}

      {/* @mention popover (groups only) */}
      {mentionEnabled && mentionOpen && mentionResults.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2 max-h-40 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1 shadow-xl"
        >
          {mentionResults.map((m, i) => (
            <button
              key={m.id}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(m);
              }}
              onMouseEnter={() => setMentionIndex(i)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                i === mentionIndex
                  ? "bg-[var(--accent-bg)] text-[var(--accent)]"
                  : "text-[var(--text)] hover:bg-[var(--bg-surface-hover)]"
              }`}
            >
              <MentionAvatar member={m} size={26} />
              <span className="truncate font-medium">{m.displayName}</span>
              {m.username && <span className="text-[11px] text-[var(--text-muted)]">@{m.username}</span>}
            </button>
          ))}
        </motion.div>
      )}

      <div className="chat-led-border chat-composer-surface flex items-center gap-1.5 rounded-2xl border border-white/10 bg-[#0c1b2b]/90 px-1.5 py-1.5 shadow-[0_12px_28px_-18px_rgba(0,0,0,.9),inset_0_1px_rgba(255,255,255,.06)] transition-[border-color,box-shadow] focus-within:border-cyan-300/35 focus-within:shadow-[0_0_0_3px_rgba(34,211,238,.06),0_12px_28px_-18px_rgba(0,0,0,.9)]">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploadingMedia || busy}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] disabled:opacity-30"
          aria-label="Enviar arquivo"
        >
          {uploadingMedia ? <span className="text-[9px]">{uploadProgress}%</span> : <Paperclip size={15} />}
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={uploadingMedia || busy} aria-label="Enviar imagem" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] disabled:opacity-30"><ImageIcon size={15} /></button>
        <button onClick={() => fileRef.current?.click()} disabled={uploadingMedia || busy} aria-label="Enviar documento" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] disabled:opacity-30"><FileText size={15} /></button>
        <textarea
          ref={textAreaRef}
          rows={1}
          placeholder={replying ? "Responder..." : "Mensagem..."}
          value={input}
          onChange={(e) => {
            const value = e.target.value;
            const word = value.slice(value.lastIndexOf(" ") + 1);
            setInput(value);
            setMentionIndex(0);
            setMentionOpen(Boolean(mentionEnabled && word.startsWith("@")));
          }}
          onBlur={() => setMentionOpen(false)}
          onKeyDown={handleKeyDown}
          className="min-h-6 max-h-20 w-full resize-none overflow-y-hidden bg-transparent text-sm leading-5 text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none"
        />
        <AnimatePresence mode="wait" initial={false}>
          {input.trim() ? (
            <motion.button key="send" initial={{ opacity: 0, scale: 0.75 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.75 }}
              onClick={() => void sendText(input)} disabled={busy} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-black transition hover:brightness-110 disabled:opacity-30" aria-label="Enviar mensagem">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
