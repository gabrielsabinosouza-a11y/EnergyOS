export type NavigationItem = {
  id:
    | "overview"
    | "planner"
    | "consistency"
    | "focusRooms"
    | "friends"
    | "league"
    | "groups"
    | "store"
    | "garden"
    | "profile"
    | "settings";
  label: string;
  shortLabel: string;
  route: string;
  mobileRoute: string;
  icon:
    | "dashboard"
    | "planner"
    | "consistency"
    | "rooms"
    | "friends"
    | "league"
    | "groups"
    | "store"
    | "garden"
    | "profile"
    | "settings";
  order: number;
  badge?: "dm" | "group";
};

export const navigationItems: readonly NavigationItem[] = [
  {
    id: "overview",
    label: "Visão geral",
    shortLabel: "Hoje",
    route: "/dashboard",
    mobileRoute: "/",
    icon: "dashboard",
    order: 1,
  },
  {
    id: "planner",
    label: "Planejamento",
    shortLabel: "Planejar",
    route: "/planner",
    mobileRoute: "/planner",
    icon: "planner",
    order: 2,
  },
  {
    id: "consistency",
    label: "Consistência",
    shortLabel: "Consist.",
    route: "/dashboard/consistencia",
    mobileRoute: "/more/reports",
    icon: "consistency",
    order: 3,
  },
  {
    id: "focusRooms",
    label: "Salas de foco",
    shortLabel: "Foco",
    route: "/salas-de-foco",
    mobileRoute: "/focus",
    icon: "rooms",
    order: 4,
  },
  {
    id: "friends",
    label: "Amigos",
    shortLabel: "Social",
    route: "/amigos",
    mobileRoute: "/social",
    icon: "friends",
    order: 5,
    badge: "dm",
  },
  {
    id: "league",
    label: "Liga",
    shortLabel: "Liga",
    route: "/liga",
    mobileRoute: "/more/league",
    icon: "league",
    order: 6,
  },
  {
    id: "groups",
    label: "Grupos",
    shortLabel: "Grupos",
    route: "/grupos",
    mobileRoute: "/social",
    icon: "groups",
    order: 7,
    badge: "group",
  },
  {
    id: "store",
    label: "Loja",
    shortLabel: "Loja",
    route: "/loja",
    mobileRoute: "/more/store",
    icon: "store",
    order: 8,
  },
  {
    id: "garden",
    label: "Meu jardim",
    shortLabel: "Jardim",
    route: "/jardim",
    mobileRoute: "/more/garden",
    icon: "garden",
    order: 9,
  },
  {
    id: "profile",
    label: "Meu perfil",
    shortLabel: "Perfil",
    route: "/perfil",
    mobileRoute: "/profile",
    icon: "profile",
    order: 10,
  },
  {
    id: "settings",
    label: "Configurações",
    shortLabel: "Ajustes",
    route: "/configuracoes",
    mobileRoute: "/more/settings",
    icon: "settings",
    order: 11,
  },
] as const;

export type NavigationItemId = NavigationItem["id"];
