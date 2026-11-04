-- Normalize legacy league tier labels after the enum rename.
--
-- migrations/2026-11-03-league-tier-expansion.sql renamed the `league_tier` enum
-- values (PRATA->SILVER, OURO->GOLD, DIAMANTE->DIAMOND, LENDAS->LEGENDS) and
-- rewrote the monthly recap tables, but `league_groups.tier` is a TEXT column,
-- so existing league group rows kept the pre-rename labels. The weekly settlement
-- (runWeeklyLeagueReset) resolves legacy aliases before reward lookups, but the
-- persisted rows should also hold canonical values.

UPDATE league_groups SET tier = 'SILVER' WHERE tier::text = 'PRATA';
UPDATE league_groups SET tier = 'GOLD' WHERE tier::text = 'OURO';
UPDATE league_groups SET tier = 'DIAMOND' WHERE tier::text = 'DIAMANTE';
UPDATE league_groups SET tier = 'LEGENDS' WHERE tier::text = 'LEGENDS';
