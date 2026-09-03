/**
 * Shared focus-duration bounds and formatters.
 *
 * The circular picker, dashboard timer, focus rooms, and session APIs all
 * read from here so the unit (minutes), snap, and max cannot drift apart.
 */

/** Minimum settable duration in the picker (minutes). */
export const FOCUS_DURATION_MIN_MINUTES = 10;

/**
 * Maximum settable duration for a single session (minutes).
 * Matches `startFocusSession`'s server-side cap.
 */
export const FOCUS_DURATION_MAX_MINUTES = 240;

/** Drag / keyboard snap increment (minutes). */
export const FOCUS_DURATION_SNAP_MINUTES = 5;

/** Default duration when creating a session or room. */
export const FOCUS_DURATION_DEFAULT_MINUTES = 60;

export const FOCUS_DURATION_IDLE_LABEL = "minutos de foco";

/** Ring fill fraction for a duration in [min, max]. */
export function focusDurationProgress(
  minutes: number,
  min: number = FOCUS_DURATION_MIN_MINUTES,
  max: number = FOCUS_DURATION_MAX_MINUTES,
): number {
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (minutes - min) / (max - min)));
}

/** Live countdown as MM:SS (minutes may exceed 99). */
export function formatCountdownMmSs(totalSeconds: number): string {
  const m = Math.max(0, Math.floor(totalSeconds / 60));
  const s = Math.max(0, Math.floor(totalSeconds % 60));
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function isValidFocusDurationMinutes(value: number): boolean {
  return Number.isInteger(value)
    && value >= FOCUS_DURATION_MIN_MINUTES
    && value <= FOCUS_DURATION_MAX_MINUTES;
}
