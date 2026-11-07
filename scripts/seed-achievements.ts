#!/usr/bin/env node
/**
 * Seed missing achievements.
 * Idempotent: safe to run multiple times.
 *
 * Usage: npx ts-node scripts/seed-achievements.ts
 */

import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const ACHIEVEMENTS = [
  {
    id: "streak_master",
    title: "Mestre da Sequência",
    description: "Mantenha sequências de consistência",
    category: "streak",
  },
  {
    id: "deep_focus",
    title: "Foco Profundo",
    description: "Complete sessões longas de foco",
    category: "focus",
  },
  {
    id: "early_riser",
    title: "Madrugador",
    description: "Faça check-in antes das 7h",
    category: "checkin",
  },
  {
    id: "sleep_champion",
    title: "Campeão do Sono",
    description: "Durma 7 horas ou mais",
    category: "sleep",
  },
  {
    id: "consistency_king",
    title: "Rei da Consistência",
    description: "Semanas perfeitas de foco",
    category: "checkin",
  },
  {
    id: "xp_olympian",
    title: "Olimpiano de XP",
    description: "Acumule minutos de foco ao longo da vida",
    category: "focus",
  },
  {
    id: "social_spark",
    title: "Faísca Social",
    description: "Faça amigos e entre em grupos",
    category: "social",
  },
  {
    id: "rarest_aura",
    title: "Líder do Núcleo",
    description: "Lidere a antiga liga Núcleo",
    category: "league",
  },
  {
    id: "top_1_global",
    title: "Top 1 Global",
    description: "Termine em 1º lugar na Liga Lendas",
    category: "league",
  },
  {
    id: "squad_leader",
    title: "Líder de Esquadrão",
    description: "Tenha o maior grupo onde você é dono",
    category: "social",
  },
  {
    id: "focus_companion",
    title: "Companheiro de Foco",
    description: "Conclua sessões focando com outras pessoas",
    category: "focus",
  },
  {
    id: "flow_state",
    title: "Estado de Fluxo",
    description: "Complete uma sessão de foco ininterrupta",
    category: "focus",
  },
  {
    id: "aura_collector",
    title: "Colecionador de Auras",
    description: "Colecione uma porcentagem das auras disponíveis",
    category: "aura",
  },
];

async function main() {
  try {
    console.log("Seeding achievements...");

    for (const achievement of ACHIEVEMENTS) {
      const result = await pool.query(
        `insert into achievements (id, title, description, category)
         values ($1, $2, $3, $4)
         on conflict (id) do nothing
         returning id`,
        [achievement.id, achievement.title, achievement.description, achievement.category]
      );

      if (result.rows.length > 0) {
        console.log(`  ✓ Inserted ${achievement.id}`);
      } else {
        console.log(`  - ${achievement.id} already exists`);
      }
    }

    console.log("\n✓ Achievements seeded successfully");
  } catch (error) {
    console.error("ERROR:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
