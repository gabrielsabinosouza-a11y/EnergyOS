import {
  BookOpen,
  Brain,
  Briefcase,
  Coffee,
  Code,
  Dumbbell,
  Gamepad2,
  GraduationCap,
  Heart,
  Leaf,
  Moon,
  Music,
  Palette,
  PenLine,
  PiggyBank,
  Plane,
  Smile,
  Star,
  Tag,
  Timer,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { createElement, type CSSProperties } from "react";
import type { Category } from "@/types";

/**
 * Paleta curada para categorias personalizadas.
 * Ajustada ao tema escuro do app; evita o vermelho semântico de erros (#ff6b6b / red-400).
 */
export const CATEGORY_PALETTE: readonly string[] = [
  "#71d4ff", // céu
  "#6bffb8", // menta
  "#b69cff", // lavanda
  "#ffd471", // ouro
  "#ffb86b", // âmbar
  "#ff9f6b", // pêssego
  "#f472b6", // rosa
  "#e879f9", // fúcsia
  "#a3e635", // lima
  "#94a3b8", // neutro
];

export const DEFAULT_CATEGORY_COLOR = CATEGORY_PALETTE[0];

/** Categoria padrão para onde itens caem quando uma categoria é excluída. */
export const FALLBACK_CATEGORY_NAME = "Outros";

export interface CategoryIconOption {
  value: string;
  label: string;
  icon: LucideIcon;
}

/** Smart planner categories with emojis for the weekly planner modal. */
export interface SmartCategory {
  id: number;
  name: string;
  emoji: string;
  icon: LucideIcon;
  color: string;
}

export const SMART_PLANNER_CATEGORIES: readonly SmartCategory[] = [
  { id: 1, name: "Fé", emoji: "⛪", icon: Heart, color: "#e879f9" },
  { id: 2, name: "Estudo", emoji: "📚", icon: BookOpen, color: "#71d4ff" },
  { id: 3, name: "Trabalho", emoji: "💼", icon: Briefcase, color: "#94a3b8" },
  { id: 4, name: "Treino", emoji: "🏋️", icon: Dumbbell, color: "#ffb86b" },
  { id: 5, name: "Metas", emoji: "🎯", icon: Star, color: "#6bffb8" },
  { id: 6, name: "Hobby", emoji: "🎮", icon: Gamepad2, color: "#b69cff" },
  { id: 7, name: "Família", emoji: "👨‍👩‍👧", icon: Heart, color: "#f472b6" },
  { id: 8, name: "Aprendizado", emoji: "🧠", icon: Brain, color: "#a3e635" },
  { id: 9, name: "Outros", emoji: "✨", icon: Zap, color: "#ffd471" },
];

/** Ícones curados para categorias personalizadas (~18 opções). */
export const CATEGORY_ICON_OPTIONS: readonly CategoryIconOption[] = [
  { value: "book", label: "Livro", icon: BookOpen },
  { value: "graduation", label: "Estudo", icon: GraduationCap },
  { value: "dumbbell", label: "Treino", icon: Dumbbell },
  { value: "heart", label: "Saúde", icon: Heart },
  { value: "briefcase", label: "Trabalho", icon: Briefcase },
  { value: "palette", label: "Arte", icon: Palette },
  { value: "music", label: "Música", icon: Music },
  { value: "gamepad", label: "Jogos", icon: Gamepad2 },
  { value: "moon", label: "Sono", icon: Moon },
  { value: "timer", label: "Foco", icon: Timer },
  { value: "zap", label: "Energia", icon: Zap },
  { value: "code", label: "Código", icon: Code },
  { value: "brain", label: "Mente", icon: Brain },
  { value: "leaf", label: "Natureza", icon: Leaf },
  { value: "coffee", label: "Café", icon: Coffee },
  { value: "star", label: "Favoritos", icon: Star },
  { value: "smile", label: "Bem-estar", icon: Smile },
  { value: "piggy-bank", label: "Finanças", icon: PiggyBank },
  { value: "plane", label: "Viagem", icon: Plane },
  { value: "pen", label: "Escrita", icon: PenLine },
];

const CATEGORY_ICON_MAP = new Map(CATEGORY_ICON_OPTIONS.map((o) => [o.value, o.icon]));

/** Ícone de uma categoria com fallback (Tag) para valores desconhecidos/antigos. */
export function categoryIcon(icon: string | null | undefined): LucideIcon {
  if (!icon) return Tag;
  return CATEGORY_ICON_MAP.get(icon) ?? Tag;
}

/**
 * Resolve e devolve o ícone de uma categoria já como elemento.
 * Existe para o React Compiler: criar um componente dinamicamente direto no
 * corpo de um componente quebra a identidade entre renders (regra
 * `react-hooks/static-components`); aqui a resolução acontece fora dele.
 */
export function renderCategoryGlyph(icon: string | null | undefined, size: number, style?: CSSProperties) {
  const Icon = categoryIcon(icon);
  return createElement(Icon, { size, style });
}

/**
 * Ordem de exibição nos seletores: categorias padrão do sistema primeiro
 * (com "Outros" sempre por último), depois as personalizadas do usuário.
 */
export function sortCategoriesForPicker(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => {
    if (!a.userId && b.userId) return -1;
    if (a.userId && !b.userId) return 1;
    if (!a.userId && !b.userId) {
      if (a.name === FALLBACK_CATEGORY_NAME) return 1;
      if (b.name === FALLBACK_CATEGORY_NAME) return -1;
    }
    return a.name.localeCompare(b.name, "pt-BR");
  });
}
