"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Image as ImageIcon,
  FileText,
  Loader2,
  Megaphone,
  Mic,
  Paperclip,
  Send,
  Square,
  Video,
  Trash2,
  Pause,
  Play,
} from "lucide-react";
import { MAX_AUDIO_SECONDS, MAX_VIDEO_SECONDS, validateImageFile, validateMediaSize, validateVideoFile, readVideoDuration, uploadToCloudinary } from "@/lib/media";

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
  /** Persist a media send (IMAGE/VIDEO/AUDIO/DOCUMENT). */
  onSendMedia: (opts: {
    messageType: string;
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
 * Shared full-featured message composer used as ChatThread's `inputSlot` by
 * BOTH the DM (Amigos) and group (Grupos) chats, so media + voice behave
 * identically everywhere. Group-only @mention autocomplete is enabled
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
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [shortRecording, setShortRecording] = useState(false);
  const [recordedPreview, setRecordedPreview] = useState<{ blob: Blob; url: string; mimeType: string; duration: number } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionOpen, setMentionOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef(0);
  const recordingSecondsRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);
  const pausedMsRef = useRef(0);
  const cancelRecordingRef = useRef(false);
  const recordingMimeRef = useRef("audio/webm");

  useEffect(() => () => {
    if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (recordedPreview) URL.revokeObjectURL(recordedPreview.url);
  }, [recordedPreview]);

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

  async function handleSendVideo(file: File) {
    if (uploadingMedia || busy) return;
    setUploadingMedia(true);
    setLocalError(null);
    try {
      validateVideoFile(file);
      const durationSeconds = await readVideoDuration(file);
      if (durationSeconds <= 0 || durationSeconds > MAX_VIDEO_SECONDS) {
        setLocalError(`Vídeos devem ter no máximo ${MAX_VIDEO_SECONDS}s.`);
        return;
      }
      const { secureUrl } = await uploadToCloudinary(file, setUploadProgress);
      await pushMedia({
        messageType: "VIDEO",
        mediaUrl: secureUrl,
        mediaDurationSeconds: durationSeconds || undefined,
        mediaFileName: file.name, mediaMimeType: file.type, mediaSizeBytes: file.size,
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Não foi possível enviar o vídeo.");
    } finally {
      setUploadingMedia(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) await handleSendImage(file);
    else if (file.type === "video/mp4" || /\.mp4$/i.test(file.name)) await handleSendVideo(file);
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

  async function handleSendVoice(blob: Blob, mimeType: string, durationSeconds: number) {
    if (busy) return;
    setLocalError(null);
    try {
      setUploadingMedia(true);
      if (blob.size > 10 * 1024 * 1024) throw new Error("Áudios devem ter no máximo 10 MB.");
      const extension = mimeType.includes("mp4") ? "m4a" : "webm";
      const file = new File([blob], `audio.${extension}`, { type: mimeType });
      const { secureUrl } = await uploadToCloudinary(file, setUploadProgress);
      if (durationSeconds > MAX_AUDIO_SECONDS) throw new Error("Áudios devem ter no máximo 5 minutos.");
      await pushMedia({
        messageType: "AUDIO",
        mediaUrl: secureUrl,
        mediaDurationSeconds: durationSeconds,
        mediaFileName: file.name, mediaMimeType: mimeType, mediaSizeBytes: blob.size,
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Não foi possível enviar o áudio.");
      throw error;
    } finally {
      setUploadingMedia(false);
    }
  }

  async function startRecording() {
    setLocalError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setLocalError("Este navegador não oferece gravação de áudio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const preferred = ["audio/webm;codecs=opus", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported?.(type));
      const recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
      recordingMimeRef.current = recorder.mimeType || preferred || "audio/webm";
      recordingChunksRef.current = [];
      cancelRecordingRef.current = false;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        recordingStreamRef.current = null;
        if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
        const mimeType = recordingMimeRef.current.split(";")[0] || "audio/webm";
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        recordingChunksRef.current = [];
        setRecording(false);
        setRecordingPaused(false);
        if (cancelRecordingRef.current) return;
        const duration = recordingSecondsRef.current;
        if (duration < 1 || blob.size === 0) {
          setShortRecording(true);
          window.setTimeout(() => setShortRecording(false), 350);
          return;
        }
        const url = URL.createObjectURL(blob);
        setRecordedPreview({ blob, url, mimeType, duration });
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingSeconds(0);
      setRecording(true);
      setRecordingPaused(false);
      recordingStartedAtRef.current = Date.now();
      pausedMsRef.current = 0;
      pausedAtRef.current = null;
      recordingSecondsRef.current = 0;
      recordingTimerRef.current = window.setInterval(() => {
        if (mediaRecorderRef.current !== recorder || recorder.state !== "recording") return;
        const pausedNow = pausedAtRef.current === null ? 0 : Date.now() - pausedAtRef.current;
        const seconds = Math.floor((Date.now() - recordingStartedAtRef.current - pausedMsRef.current - pausedNow) / 1000);
        recordingSecondsRef.current = seconds;
        setRecordingSeconds(seconds);
        if (seconds >= MAX_AUDIO_SECONDS) stopRecording();
      }, 250);
    } catch (error) {
      setLocalError(error instanceof DOMException && error.name === "NotAllowedError"
        ? "Permita o acesso ao microfone nas configurações do navegador."
        : "Não foi possível acessar o microfone.");
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    mediaRecorderRef.current = null;
  }

  function toggleRecordingPause() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      pausedAtRef.current = Date.now();
      setRecordingPaused(true);
    } else if (recorder.state === "paused") {
      if (pausedAtRef.current !== null) pausedMsRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
      recorder.resume();
      setRecordingPaused(false);
    }
  }

  function cancelRecording() {
    cancelRecordingRef.current = true;
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    setRecording(false);
    setRecordingPaused(false);
    setRecordingSeconds(0);
  }

  function discardPreview() {
    if (recordedPreview) URL.revokeObjectURL(recordedPreview.url);
    setRecordedPreview(null);
    setRecordingSeconds(0);
  }

  async function sendRecordedPreview() {
    if (!recordedPreview || busy) return;
    try {
      await handleSendVoice(recordedPreview.blob, recordedPreview.mimeType, recordedPreview.duration);
      discardPreview();
    } catch { /* the preview remains available for a retry */ }
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

  useEffect(() => {
    const textarea = textAreaRef.current;
    if (!textarea) return;
    const maxHeight = 80;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [input]);

  return (
    <div className="flex-none border-t border-[var(--border-subtle)] bg-[var(--bg)]/80 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-lg sm:px-8 lg:px-12">
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

      <div className="chat-led-border glass-card flex items-center gap-1.5 px-2 py-2 transition-transform focus-within:-translate-y-px focus-within:shadow-lg">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/mp4,.mp4,application/pdf,text/plain,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploadingMedia || busy || recording}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] disabled:opacity-30"
          aria-label="Enviar arquivo"
        >
          {uploadingMedia ? <span className="text-[9px]">{uploadProgress}%</span> : <Paperclip size={15} />}
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={uploadingMedia || busy || recording} aria-label="Enviar imagem" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] disabled:opacity-30"><ImageIcon size={15} /></button>
        <button onClick={() => fileRef.current?.click()} disabled={uploadingMedia || busy || recording} aria-label="Enviar documento" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] disabled:opacity-30"><FileText size={15} /></button>
        <button onClick={() => fileRef.current?.click()} disabled={uploadingMedia || busy || recording} aria-label="Enviar vídeo MP4" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] disabled:opacity-30"><Video size={15} /></button>
        {recording ? (
          <div className={`chat-led-border flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/5 px-2 py-1.5 ${shortRecording ? "animate-[chat-shake_.22s_ease-in-out]" : ""}`}>
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-400" />
            <span className={`shrink-0 font-mono text-xs tabular-nums ${MAX_AUDIO_SECONDS - recordingSeconds <= 30 ? "text-red-300" : "text-[var(--text)]"}`} aria-live="off">{MAX_AUDIO_SECONDS - recordingSeconds <= 30 ? `${Math.floor(Math.max(0, MAX_AUDIO_SECONDS - recordingSeconds) / 60)}:${String(Math.max(0, MAX_AUDIO_SECONDS - recordingSeconds) % 60).padStart(2, "0")}` : `${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")}`}</span>
            <div className="flex h-7 min-w-0 flex-1 items-center justify-center gap-[2px] overflow-hidden" aria-hidden="true">
              {Array.from({ length: 28 }, (_, i) => <span key={i} className="w-[2px] rounded-full bg-cyan-300/70 animate-pulse" style={{ height: `${5 + ((i * 13 + recordingSeconds * 7) % 19)}px`, animationDelay: `${(i % 7) * 70}ms` }} />)}
            </div>
            <button type="button" onClick={toggleRecordingPause} aria-label={recordingPaused ? "Retomar gravação" : "Pausar gravação"} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]">{recordingPaused ? <Play size={15} /> : <Pause size={15} />}</button>
            <button type="button" onClick={cancelRecording} aria-label="Cancelar gravação" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-red-300 hover:bg-red-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-300"><Trash2 size={15} /></button>
            <button type="button" onClick={stopRecording} aria-label="Concluir gravação" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)] text-black hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><Square size={13} /></button>
          </div>
        ) : recordedPreview ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-cyan-300/20 bg-white/5 px-2 py-1.5">
            <audio src={recordedPreview.url} controls className="h-9 min-w-0 flex-1" aria-label="Prévia do áudio gravado" />
            <button type="button" onClick={discardPreview} aria-label="Descartar áudio" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-red-300 hover:bg-red-400/10"><Trash2 size={15} /></button>
            <button type="button" onClick={() => void sendRecordedPreview()} disabled={busy || uploadingMedia} aria-label="Enviar áudio" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--accent)] text-black disabled:opacity-50">{busy || uploadingMedia ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}</button>
          </div>
        ) : (
          <textarea
            ref={textAreaRef}
            rows={1}
            placeholder={replying ? "Responder..." : "Mensagem..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onBlur={() => setMentionOpen(false)}
            onKeyDown={handleKeyDown}
            className="min-h-6 max-h-20 w-full resize-none overflow-y-hidden bg-transparent text-sm leading-5 text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none"
          />
        )}
        {!recording && !recordedPreview && (
          <AnimatePresence mode="wait" initial={false}>
            {input.trim() ? (
              <motion.button key="send" initial={{ opacity: 0, scale: 0.75 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.75 }}
                onClick={() => void sendText(input)} disabled={busy} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-black transition hover:brightness-110 disabled:opacity-30" aria-label="Enviar mensagem">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </motion.button>
            ) : (
              <motion.button key="mic" initial={{ opacity: 0, scale: 0.75 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.75 }}
                onClick={() => void startRecording()} disabled={uploadingMedia || busy} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] disabled:opacity-30" aria-label="Gravar áudio">
                <Mic size={15} />
              </motion.button>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
