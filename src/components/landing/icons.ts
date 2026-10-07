import {
  BookOpen,
  ChartNoAxesColumn,
  ClipboardCheck,
  Dumbbell,
  Flame,
  ListChecks,
  Moon,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** One icon per concept — use everywhere on the landing page. */
export const landingIcons = {
  energia: Zap,
  sono: Moon,
  estudo: BookOpen,
  treino: Dumbbell,
  foco: Target,
  checkin: ClipboardCheck,
  constancia: Flame,
  clareza: ChartNoAxesColumn,
  metas: ListChecks,
} as const satisfies Record<string, LucideIcon>;

export type LandingIconKey = keyof typeof landingIcons;

export const LANDING_ICON_STROKE = 1.75;
export const LANDING_ICON_SIZE_ROW = 16;
export const LANDING_ICON_SIZE_CHIP = 20;
