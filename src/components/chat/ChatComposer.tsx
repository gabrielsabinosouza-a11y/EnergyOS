"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Image as ImageIcon,
  Loader2,
  Mic,
  Send,
  Square,
  Sticker,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { MAX_VIDEO_SECONDS, readVideoDuration, uploadToCloudinary } from "@/lib/media";

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
  /** Persist a media send (IMAGE/VIDEO/AUDIO/STICKER). */
  onSendMedia: (opts: {
    messageType: string;
    mediaUrl?: string;
    body?: string;
    mediaDurationSeconds?: number;
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
 * Shared full-featured message composer used as ChatThread's `inputSlot` by
 * BOTH the DM (Amigos) and group (Grupos) chats, so media + stickers + voice
 * behave identically everywhere. Group-only @mention autocomplete is enabled
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
  const [recording, setRecording] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [stickers, setStickers] = useState<{ id: string; emoji: string }[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionOpen, setMentionOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    api.getGroupStickers().then((d) => setStickers(d.stickers)).catch(() => {});
  }, []);

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
    messageType: string;
    mediaUrl?: string;
    body?: string;
    mediaDurationSeconds?: number;
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
      const { secureUrl } = await uploadToCloudinary(file);
      await pushMedia({ messageType: "IMAGE", mediaUrl: secureUrl });
    } catch {
      setLocalError("Não foi possível enviar a imagem.");
    } finally {
      setUploadingMedia(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSendVideo(file: File) {
    if (uploadingMedia || busy) return;
    setUploadingMedia(true);
    setLocalError(null);
    try {
      const durationSeconds = await readVideoDuration(file);
      if (durationSeconds > 0 && durationSeconds > MAX_VIDEO_SECONDS) {
        setLocalError(`Vídeos devem ter no máximo ${MAX_VIDEO_SECONDS}s.`);
        return;
      }
      const { secureUrl } = await uploadToCloudinary(file);
      await pushMedia({
        messageType: "VIDEO",
        mediaUrl: secureUrl,
        mediaDurationSeconds: durationSeconds || undefined,
      });
    } catch {
      setLocalError("Não foi possível enviar o vídeo.");
    } finally {
      setUploadingMedia(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) await handleSendImage(file);
    else if (file.type.startsWith("video/")) await handleSendVideo(file);
    else setLocalError("Formato de arquivo não suportado.");
  }

  async function handleSendSticker(emoji: string) {
    if (busy) return;
    setShowStickers(false);
    setLocalError(null);
    try {
      await pushMedia({ messageType: "STICKER", body: emoji });
    } catch {
      setLocalError("Não foi possível enviar o sticker.");
    }
  }

  async function handleSendVoice(blob: Blob) {
    if (busy) return;
    setLocalError(null);
    try {
      setUploadingMedia(true);
      const file = new File([blob], "voice.webm", { type: "audio/webm" });
      const { secureUrl, durationSeconds } = await uploadToCloudinary(file);
      await pushMedia({
        messageType: "AUDIO",
        mediaUrl: secureUrl,
        mediaDurationSeconds: durationSeconds ?? Math.round(blob.size / 16000),
      });
    } catch {
      setLocalError("Não foi possível enviar o áudio.");
    } finally {
      setUploadingMedia(false);
    }
  }

  async function startRecording() {
    setLocalError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordingChunksRef.current, { type: "audio/webm" });
        recordingChunksRef.current = [];
        if (blob.size > 0) await handleSendVoice(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setLocalError("Microfone não disponível.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }

  /* ─── @mention autocomplete (groups only) ──────────────────────── */

  const mentionEnabled = Boolean(mentionMembers?.length);
  const lastSpaceIdx = input.lastIndexOf(" ");
  const activeWord = input.slice(lastSpaceIdx + 1);

  useEffect(() => {
    const word = input.slice(input.lastIndexOf(" ") + 1);
    setMentionOpen(Boolean(mentionEnabled && word.startsWith("@")));
  }, [input, mentionEnabled]);

  const mentionQuery = mentionEnabled && activeWord.startsWith("@") ? activeWord.slice(1) : null;

  const mentionResults = useMemo(() => {
    if (mentionQuery === null || !mentionMembers) return [];
    const q = mentionQuery.toLowerCase();
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
    return matches
      .sort((a, b) => score(b) - score(a) || a.displayName.localeCompare(b.displayName))
      .slice(0, 8);
  }, [mentionQuery, mentionMembers, currentUserId]);

  useEffect(() => {
    setMentionIndex(0);
  }, [mentionQuery]);

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

  return (
    <div className="border-t border-[var(--border-subtle)] bg-[var(--bg)]/80 px-5 py-3 backdrop-blur-lg sm:px-8 lg:px-12">
      {shownError && <p className="mb-2 text-[11px] text-[var(--red)]">{shownError}</p>}

      {/* Sticker picker */}
      <AnimatePresence>
        {showStickers && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="mb-2 grid max-h-40 grid-cols-8 gap-1 overflow-y-auto rounded-xl border border-[var(--border-subtle)] p-2"
          >
            {stickers.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSendSticker(s.emoji)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition hover:bg-[var(--accent-bg)]"
              >
                {s.emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

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

      <div className="glass-card flex items-center gap-1.5 px-2 py-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploadingMedia || busy || recording}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] disabled:opacity-30"
          aria-label="Enviar imagem ou vídeo"
        >
          {uploadingMedia ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={15} />}
        </button>
        <button
          onClick={() => setShowStickers((v) => !v)}
          disabled={recording}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] disabled:opacity-30"
          aria-label="Stickers"
        >
          <Sticker size={15} />
        </button>
        <input
          type="text"
          placeholder={replying ? "Responder..." : "Mensagem..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={() => setMentionOpen(false)}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none"
        />
        {recording ? (
          <button
            onClick={stopRecording}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--red)] text-white transition hover:brightness-110"
            aria-label="Parar gravação"
          >
            <Square size={13} />
          </button>
        ) : (
          <button
            onClick={() => startRecording()}
            disabled={uploadingMedia || busy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] disabled:opacity-30"
            aria-label="Gravar áudio"
          >
            <Mic size={15} />
          </button>
        )}
        <button
          onClick={() => void sendText(input)}
          disabled={!input.trim() || busy || recording}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-black transition hover:brightness-110 disabled:opacity-30"
          aria-label="Enviar"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  );
}