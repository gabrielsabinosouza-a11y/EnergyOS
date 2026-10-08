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
  Icon: LandingAssetKey;
}

export const STEPS: Step[] = [
  {
    key: "checkin",
    number: "01",
    label: "CONSISTÊNCIA",
    title: "Seu ano em quadrados.",
    text: "Cada check-in vira um quadrado. Veja sua constância ganhar forma.",
    Icon: "calendar",
  },
  {
    key: "clareza",
    number: "02",
    label: "REGISTROS",
    title: "Cada sessão deixa uma marca.",
    text: "Cada sessão de foco planta uma energia no seu jardim.",
    Icon: "energyFlame",
  },
  {
    key: "constancia",
    number: "03",
    label: "MEDIDA",
    title: "Foco no seu ritmo.",
    text: "Escolha de 10 a 120 minutos e foque no seu ritmo.",
    Icon: "focus",
  },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];
