/**
 * Seed script for EnergyOS reference data
 * Creates all required lookup/static data that the app needs to function
 * Idempotent: safe to run multiple times (uses ON CONFLICT DO NOTHING)
 * 
 * Run: npm run db:seed
 * Or: DATABASE_URL=... node scripts/seed-reference-data.mjs
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));

async function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const envFile of [".env.local", ".env"]) {
    try {
      const contents = await readFile(join(here, "..", envFile), "utf8");
      const match = contents.match(/^DATABASE_URL=(.*)$/m);
      if (match?.[1]) return match[1].trim();
    } catch {
      // optional file
    }
  }
  return undefined;
}

const connectionString = await resolveDatabaseUrl();

if (!connectionString) {
  console.error("DATABASE_URL não definida. Use: DATABASE_URL=... npm run db:seed");
  process.exit(1);
}

const isNeon = /neon\.tech/.test(connectionString);
const sslStrict = process.env.NODE_ENV === "production" || process.env.DATABASE_SSL_STRICT === "true";

const client = new pg.Client({
  connectionString,
  ssl: isNeon ? (sslStrict ? { rejectUnauthorized: true } : { rejectUnauthorized: false }) : undefined,
});

try {
  await client.connect();
  console.log("Conectado ao banco de dados...\n");

  // 1. Default Categories (already in schema, but let's ensure they exist)
  console.log("📁 Inserindo categorias padrão...");
  await client.query(`
    INSERT INTO categories (user_id, name, color, icon, is_custom) VALUES
      (null, 'Sono',   '#71d4ff', 'moon',     false),
      (null, 'Estudo', '#b69cff', 'timer',    false),
      (null, 'Treino', '#ffb86b', 'dumbbell', false),
      (null, 'Foco',   '#ff9f6b', 'zap',      false),
      (null, 'Outros', '#94a3b8', null,       false)
    ON CONFLICT (coalesce(user_id, ''), lower(name)) DO NOTHING
  `);
  console.log("✅ Categorias padrão inseridas\n");

  // 2. Achievements (already in schema, but ensure they exist)
  console.log("🏆 Inserindo conquistas...");
  const achievements = [
    ['streak_master',    'Mestre da Sequência',  'Mantenha sequências de consistência',           'streak'],
    ['deep_focus',       'Foco Profundo',        'Complete sessões longas de foco',               'focus'],
    ['early_riser',      'Madrugador',           'Faça check-in antes das 7h',                    'checkin'],
    ['sleep_champion',   'Campeão do Sono',      'Durma 7 horas ou mais',                         'sleep'],
    ['consistency_king', 'Rei da Consistência',  'Semanas perfeitas de foco',                'checkin'],
    ['xp_olympian',      'Olimpiano de XP',      'Acumule minutos de foco ao longo da vida',      'focus'],
    ['social_spark',     'Faísca Social',        'Faça amigos e entre em grupos',                 'social'],
    ['rarest_aura',      'Top 1 Global',         'Termine no topo da Liga Lendários',                'league'],
    ['squad_leader',     'Líder de Esquadrão',   'Tenha o maior grupo onde você é dono',             'social'],
    ['focus_companion',  'Companheiro de Foco', 'Conclua sessões focando com outras pessoas',  'focus'],
    ['flow_state',       'Estado de Fluxo',     'Complete uma sessão de foco ininterrupta',      'focus'],
    ['aura_collector',   'Colecionador de Auras','Colecione uma porcentagem das auras disponíveis','aura']
  ];
  
  for (const [id, title, description, category] of achievements) {
    await client.query(`
      INSERT INTO achievements (id, title, description, category) VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO NOTHING
    `, [id, title, description, category]);
  }
  console.log("✅ Conquistas inseridas\n");

  // 3. Daily Quests
  console.log("🎯 Inserindo missões diárias...");
  const dailyQuests = [
    ['Complete 1 sessão de foco', 'Conclua 1 sessão de foco hoje', 'SESSIONS_COMPLETED', 'SESSIONS_COUNT', 1, 10],
    ['Complete 2 sessões de foco', 'Conclua 2 sessões de foco hoje', 'SESSIONS_COMPLETED', 'SESSIONS_COUNT', 2, 10],
    ['Complete 3 sessões de foco', 'Conclua 3 sessões de foco hoje', 'SESSIONS_COMPLETED', 'SESSIONS_COUNT', 3, 15],
    ['Foque 30 minutos hoje', 'Acumule 30 minutos de foco hoje', 'TOTAL_MINUTES', 'TOTAL_MINUTES', 30, 10],
    ['Foque 60 minutos hoje', 'Acumule 60 minutos de foco hoje', 'TOTAL_MINUTES', 'TOTAL_MINUTES', 60, 10],
    ['Foque 90 minutos hoje', 'Acumule 90 minutos de foco hoje', 'TOTAL_MINUTES', 'TOTAL_MINUTES', 90, 15],
    ['Participe de uma Sala de Foco', 'Participe de uma sessão em uma Sala de Foco', 'ROOM_SESSION_COMPLETED', 'ROOM_SESSION', 1, 20],
    ['Participe de 2 salas diferentes', 'Participe de sessões em 2 salas de foco diferentes', 'DISTINCT_ROOMS', 'ROOM_SESSION', 2, 15],
    ['Complete 3 tarefas hoje', 'Conclua 3 tarefas hoje', 'TASKS_COMPLETED', 'SESSIONS_COUNT', 3, 10],
    ['Mantenha seu streak por mais um dia', 'Atinja a qualificação diária de streak hoje', 'STREAK_DAY', 'SESSIONS_COUNT', 1, 15],
    ['Complete uma sessão de 60+ minutos', 'Conclua uma única sessão de foco com 60 minutos ou mais', 'LONG_SESSION_60', 'SESSIONS_COUNT', 1, 20],
    ['Complete 3 hábitos hoje', 'Conclua 3 hábitos diferentes hoje', 'HABITS_COMPLETED', 'SESSIONS_COUNT', 3, 10],
    ['Foque antes das 9h', 'Complete uma sessão de foco iniciada antes das 9h', 'EARLY_SESSION_9AM', 'SESSIONS_COUNT', 1, 15],
    ['Complete uma missão da semana', 'Conclua uma missão do seu plano da semana', 'WEEKLY_PLAN_COMPLETED', 'SESSIONS_COUNT', 1, 15],
    ['Ganhe 50 XP hoje', 'Acumule 50 pontos de XP hoje', 'XP_EARNED', 'SESSIONS_COUNT', 50, 20]
  ];
  
  for (const [title, description, metric, type, targetValue, coinReward] of dailyQuests) {
    await client.query(`
      INSERT INTO daily_quests (title, description, metric, type, target_value, coin_reward, is_active) 
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (title) DO NOTHING
    `, [title, description, metric, type, targetValue, coinReward]);
  }
  console.log("✅ Missões diárias inseridas\n");

  // 4. Streak Shield Designs (Shop Items)
  console.log("🛡️  Inserindo designs de escudos de streak...");
  const shieldDesigns = [
    ['shield_basic',     'Escudo Básico',          'Proteção simples e eficaz para sua sequência',        '/streak/shield_basic.png',     '/streak/shield_basic_icon.png',     200, 'common',    1],
    ['shield_energy',    'Escudo de Energia',      'Escudo que brilha com sua energia',              '/streak/shield_energy.png',    '/streak/shield_energy_icon.png',    400, 'uncommon',  2],
    ['shield_fire',      'Escudo de Fogo',         'Proteção flamejante para guerreiros do foco',     '/streak/shield_fire.png',      '/streak/shield_fire_icon.png',      600, 'rare',      3],
    ['shield_crystal',   'Escudo de Cristal',      'Defesa transparente com poder arcano',            '/streak/shield_crystal.png',   '/streak/shield_crystal_icon.png',   800, 'rare',      4],
    ['shield_golden',    'Escudo Dourado',         'O escudo definitivo para campeões',              '/streak/shield_golden.png',    '/streak/shield_golden_icon.png',    1000, 'epic',      5],
    ['shield_legendary','Escudo Lendário',       'A proteção suprema, digna das lendas',            '/streak/shield_legendary.png', '/streak/shield_legendary_icon.png', 1500, 'legendary', 6]
  ];
  
  for (const [id, name, description, image_url, icon_url, price, rarity, sort_order] of shieldDesigns) {
    await client.query(`
      INSERT INTO streak_shield_designs (id, name, description, image_url, icon_url, price, rarity, sort_order, is_active) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        icon_url = EXCLUDED.icon_url,
        price = EXCLUDED.price,
        rarity = EXCLUDED.rarity,
        sort_order = EXCLUDED.sort_order
    `, [id, name, description, image_url, icon_url, price, rarity, sort_order]);
  }
  console.log("✅ Designs de escudos inseridos\n");

  // 5. Avatar Decorations (Shop Items)
  console.log("🎨 Inserindo decorações de avatar...");
  const decorations = [
    ['frame_fire',     'Anel de Fogo',     'Um anel flamejante que envolve seu avatar',      '/decorations/frame_fire.svg',    500,  'common',    1],
    ['frame_crystal',  'Cristal Brilhante', 'Fragmentos de cristal com brilho etéreo',       '/decorations/frame_crystal.svg',  800,  'rare',      2],
    ['frame_aura',     'Aura Dourada',      'Uma aura dourada que pulsa com energia',        '/decorations/frame_aura.svg',     1200, 'epic',      3],
    ['frame_nucleo',   'Núcleo Cósmico',    'Um portal cósmico de poder absoluto',           '/decorations/frame_nucleo.svg',   2000, 'legendary', 4],
    ['frame_nature',   'Natureza Viva',     'Folhas e vines que crescem ao redor',           '/decorations/frame_nature.svg',   600,  'common',    5],
    ['frame_electric', 'Raio Elétrico',     'Faíscas elétricas que circundam o avatar',      '/decorations/frame_electric.svg', 700,  'common',    6],
    ['frame_cosmic',   'Nebulosa',          'Névoa cósmica com estrelas cintilantes',        '/decorations/frame_cosmic.svg',   1500, 'epic',      7],
    ['frame_diamond',  'Diamante Puro',     'Um frame de diamante com reflexos perfeitos',   '/decorations/frame_diamond.svg',  1800, 'legendary', 8]
  ];
  
  for (const [id, name, description, image_url, price, rarity, sort_order] of decorations) {
    await client.query(`
      INSERT INTO avatar_decorations (id, name, description, image_url, price, rarity, sort_order, is_active) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        price = EXCLUDED.price,
        rarity = EXCLUDED.rarity,
        sort_order = EXCLUDED.sort_order
    `, [id, name, description, image_url, price, rarity, sort_order]);
  }
  console.log("✅ Decorações de avatar inseridas\n");

  // 6. Daily Task Pool (Templates)
  console.log("📝 Inserindo pool de tarefas diárias...");
  // These are template tasks that users can add
  const dailyTaskPool = [
    ['Fazer exercícios', true, 1],
    ['Meditar por 10 minutos', true, 2],
    ['Beber 2L de água', true, 3],
    ['Ler um livro', true, 4],
    ['Organizar o ambiente de trabalho', true, 5]
  ];
  
  for (const [title, is_active, sort_order] of dailyTaskPool) {
    await client.query(`
      INSERT INTO daily_task_pool (title, is_active, sort_order) 
      VALUES ($1, $2, $3)
      ON CONFLICT (title) DO NOTHING
    `, [title, is_active, sort_order]);
  }
  console.log("✅ Pool de tarefas diárias inserido\n");

  // 7. Ensure ENUM types exist (they should be in schema, but just in case)
  console.log("🔧 Verificando tipos ENUM...");
  try {
    await client.query(`
      DO $$ BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_status') THEN
          CREATE TYPE room_status AS ENUM ('waiting', 'active', 'paused', 'completed', 'expired', 'restarting');
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'participant_session_status') THEN
          CREATE TYPE participant_session_status AS ENUM ('waiting', 'focusing', 'completed', 'left');
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'league_tier') THEN
          CREATE TYPE league_tier AS ENUM ('BRONZE', 'PRATA', 'OURO', 'DIAMANTE', 'LENDAS');
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quest_type') THEN
          CREATE TYPE quest_type AS ENUM ('SESSIONS_COUNT', 'TOTAL_MINUTES', 'ROOM_SESSION');
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'streak_day_status') THEN
          CREATE TYPE streak_day_status AS ENUM ('success', 'protected', 'lost');
        END IF;
      END $$;
    `);
    console.log("✅ Tipos ENUM verificados\n");
  } catch (e) {
    console.log("⚠️  Tipos ENUM já existem (ou erro):", (e as Error).message, "\n");
  }

  console.log("═══════════════════════════════════════");
  console.log("✅ Seed concluído com sucesso!");
  console.log("═══════════════════════════════════════");
  console.log("\nTabelas com dados de referência preenchidas:");
  console.log("  • categorias");
  console.log("  • achievements (conquistas)");
  console.log("  • daily_quests (missões diárias)");
  console.log("  • streak_shield_designs (escudos de streak)");
  console.log("  • avatar_decorations (decorações de avatar)");
  console.log("  • daily_task_pool (tarefas diárias templates)");
  console.log("\nPróximo passo: Inicie o app e faça login. O perfil do usuário será criado automaticamente.");

} catch (error) {
  console.error("❌ Erro durante o seed:", error);
  process.exit(1);
} finally {
  await client.end();
}
