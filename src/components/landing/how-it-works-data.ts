import {
  ClipboardCheck,
  ChartNoAxesColumn,
  type LucideIcon,
} from "lucide-react";
import { type LandingAssetKey } from "./landing-assets";

/**
 * The "Como funciona" steps. Icons are resolved at render time:
 * - string = a game-mechanic image asset (here: the streak)
 * - Lucide component = a functional icon with no landing asset (clipboard, chart)
 *
 * Keeping every icon lookup in one place means a swap later is a one-line edit.
 */
export interface Step {
  key: string;
  number: string;
  label: string;
  title: string;
  text: string;
  Icon: LucideIcon | LandingAssetKey;
}

export const STEPS: Step[] = [
  {
    key: "checkin",
    number: "01",
    label: "CHECK-IN",
    title: "Comece pelo que você sente.",
    text: "Registre sono, energia, estudo e treino em um check-in rápido. Sem planilhas, sem complicação.",
    Icon: ClipboardCheck,
  },
  {
    key: "clareza",
    number: "02",
    label: "CLAREZA",
    title: "Encontre seu próprio ritmo.",
    text: "Veja tendências e históricos para entender como seus hábitos se conectam aos seus dias.",
    Icon: ChartNoAxesColumn,
  },
  {
    key: "constancia",
    number: "03",
    label: "CONSTÂNCIA",
    title: "Transforme intenção em pequenas vitórias.",
    text: "Organize tarefas, acompanhe metas e celebre o progresso sem exigir perfeição.",
    Icon: "streakAlive" as LandingAssetKey,
  },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];
