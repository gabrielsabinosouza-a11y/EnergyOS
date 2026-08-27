export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "offline";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "offline";
  const diff = Date.now() - then;
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `há ${Math.floor(diff / 3_600_000)}h`;
  if (diff < 2 * 86_400_000) return "ontem";
  if (diff < 7 * 86_400_000) return `há ${Math.floor(diff / 86_400_000)}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function formatCountdown(resetsAt: string, now = Date.now()): string {
  const ms = new Date(resetsAt).getTime() - now;
  if (ms <= 0) return "Reinicia em instantes";
  const totalHours = Math.floor(ms / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `Reinicia em ${days}d ${hours}h`;
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `Reinicia em ${hours}h ${minutes}m`;
  return `Reinicia em ${Math.max(1, minutes)}m`;
}

export function initialsFromName(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Format a numeric stat value for display, using pt-BR locale.
 * - Rounds to 1 decimal place for fractional values
 * - Uses comma as decimal separator (pt-BR)
 * - Omits trailing ",0" for whole numbers
 * - Handles edge cases (0, null, undefined, negative)
 */
export function formatStat(value: number | null | undefined, unit?: string): string {
  if (value === null || value === undefined || value < 0) {
    return "—";
  }
  
  // For zero, return "0" with appropriate unit
  if (value === 0) {
    return unit ? `0${unit}` : "0";
  }
  
  // Check if it's a whole number
  const isWhole = value % 1 === 0;
  
  if (isWhole) {
    // Whole number - format without decimals
    return unit ? `${Math.round(value)}${unit}` : String(Math.round(value));
  }
  
  // Fractional number - round to 1 decimal and format with pt-BR locale
  const rounded = Math.round(value * 10) / 10;
  const formatted = rounded.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  
  return unit ? `${formatted}${unit}` : formatted;
}
