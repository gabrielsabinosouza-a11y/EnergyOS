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
