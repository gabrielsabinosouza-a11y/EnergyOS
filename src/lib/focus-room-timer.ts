export interface FocusRoomTimerInput {
  status: string;
  durationMinutes: number;
  startedAt?: string;
  endsAt?: string;
  pausedAt?: string;
  remainingSeconds?: number;
  elapsedSeconds?: number;
  lastResumedAt?: string;
}

/**
 * Derive the shared remaining time for a focus room from the server-side
 * absolute deadline. This is the single source of truth and must never tick a
 * client counter down on its own.
 */
export function focusRoomRemainingMs(
  room: FocusRoomTimerInput | null | undefined,
  nowMs: number,
  serverOffsetMs: number = 0,
): number | null {
  if (!room) return null;
  const isRunning = room.status === "active" || room.status === "paused";
  if (!isRunning) return null;

  const serverNowMs = nowMs + serverOffsetMs;

  if (room.status === "active" && room.endsAt) {
    const endsAtMs = new Date(room.endsAt).getTime();
    if (Number.isFinite(endsAtMs)) {
      return Math.max(0, endsAtMs - serverNowMs);
    }
  }

  if (room.status === "paused" && typeof room.remainingSeconds === "number") {
    return Math.max(0, room.remainingSeconds * 1000);
  }

  // Legacy fallback for rooms created before endsAt/remainingSeconds existed.
  const totalSec = room.durationMinutes * 60;
  let elapsed = room.elapsedSeconds ?? 0;
  if (room.status === "active") {
    const resumeAt = room.lastResumedAt
      ? new Date(room.lastResumedAt).getTime()
      : (room.startedAt ? new Date(room.startedAt).getTime() : nowMs);
    if (Number.isFinite(resumeAt)) {
      elapsed += Math.floor((nowMs - resumeAt) / 1000);
    }
  }
  return Math.max(0, (totalSec - elapsed) * 1000);
}
