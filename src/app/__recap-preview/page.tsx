"use client";

// Rota TEMPORÁRIA de conferência visual do modal de Recap (remover).
import { MonthlyRecapPremium } from "@/components/dashboard/monthly-recap-premium";

export default function RecapPreviewPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary)] p-6">
      <MonthlyRecapPremium
        recap={{
          id: 1,
          recapMonth: "2026-10-01",
          totalFocusMinutes: 3120,
          longestStreak: 47,
          leagueTier: "LENDAS",
          leaguePromoted: true,
          gardenCount: 293,
          totalXp: 6209,
          coinsGained: 120,
          missionsCompleted: 18,
          goalsCompleted: 4,
          achievementsUnlocked: 7,
          hasBeenShared: false,
          status: "live",
        }}
        status="live"
        isLive
        userName="Usuário"
      />
    </main>
  );
}
