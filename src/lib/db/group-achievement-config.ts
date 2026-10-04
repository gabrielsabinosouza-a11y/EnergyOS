export const GROUP_ACHIEVEMENTS = {
  sincronia: {
    id: "sincronia",
    title: "Sincronia",
    description: "Membros focando juntos na mesma sala de foco",
    targetMembers: 2,
    coinsPerMember: 100,
    requirement: "2+ membros focando na mesma sala ao mesmo tempo",
  },
  esquadrao_completo: {
    id: "esquadrao_completo",
    title: "Esquadrão Completo",
    description: "Todos os membros ativos focando juntos na mesma sala de foco",
    minimumMembers: 2,
    activeDays: 7,
    coinsPerMember: 150,
    requirement: "Todos os membros ativos focando na mesma sala ao mesmo tempo",
  },
  maratona_coletiva: {
    id: "maratona_coletiva",
    title: "Maratona Coletiva",
    description: "Muitos minutos combinados de foco em uma única semana",
    targetMinutes: 2000,
    coinsPerMember: 200,
    requirement: "2.000+ min combinados na mesma semana",
  },
  consistencia_de_equipe: {
    id: "consistencia_de_equipe",
    title: "Consistência de Equipe",
    description: "A equipe focando junto por vários dias seguidos",
    minimumMembers: 2,
    consecutiveDays: 5,
    coinsPerMember: 150,
    requirement: "2+ membros focando por 5 dias seguidos",
  },
} as const;

export type GroupAchievementId = (typeof GROUP_ACHIEVEMENTS)[keyof typeof GROUP_ACHIEVEMENTS]["id"];

export interface GroupAchievementUnlock {
  id: GroupAchievementId;
  title: string;
  groupId: number;
  unlockedAt: string;
}
