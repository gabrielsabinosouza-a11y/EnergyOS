-- Align persisted league tiers with the canonical progression:
-- Bronze → Silver → Gold → Emerald → Diamond → Obsidian → Legends.
ALTER TABLE league_groups DROP CONSTRAINT IF EXISTS league_groups_tier_check;

ALTER TYPE league_tier RENAME VALUE 'PRATA' TO 'SILVER';
ALTER TYPE league_tier RENAME VALUE 'OURO' TO 'GOLD';
ALTER TYPE league_tier RENAME VALUE 'DIAMANTE' TO 'DIAMOND';
ALTER TYPE league_tier RENAME VALUE 'LENDAS' TO 'LEGENDS';

ALTER TYPE league_tier ADD VALUE 'EMERALD' AFTER 'GOLD';
ALTER TYPE league_tier ADD VALUE 'OBSIDIAN' AFTER 'DIAMOND';

UPDATE monthly_recaps
SET league_tier = CASE league_tier
  WHEN 'PRATA' THEN 'SILVER'
  WHEN 'OURO' THEN 'GOLD'
  WHEN 'DIAMANTE' THEN 'DIAMOND'
  WHEN 'LENDAS' THEN 'LEGENDS'
  ELSE league_tier
END,
league_at_start = CASE league_at_start
  WHEN 'PRATA' THEN 'SILVER'
  WHEN 'OURO' THEN 'GOLD'
  WHEN 'DIAMANTE' THEN 'DIAMOND'
  WHEN 'LENDAS' THEN 'LEGENDS'
  ELSE league_at_start
END
WHERE league_tier IN ('PRATA', 'OURO', 'DIAMANTE', 'LENDAS')
   OR league_at_start IN ('PRATA', 'OURO', 'DIAMANTE', 'LENDAS');

UPDATE monthly_recap_history
SET league_at_start = CASE league_at_start
  WHEN 'PRATA' THEN 'SILVER'
  WHEN 'OURO' THEN 'GOLD'
  WHEN 'DIAMANTE' THEN 'DIAMOND'
  WHEN 'LENDAS' THEN 'LEGENDS'
  ELSE league_at_start
END,
league_at_end = CASE league_at_end
  WHEN 'PRATA' THEN 'SILVER'
  WHEN 'OURO' THEN 'GOLD'
  WHEN 'DIAMANTE' THEN 'DIAMOND'
  WHEN 'LENDAS' THEN 'LEGENDS'
  ELSE league_at_end
END
WHERE league_at_start IN ('PRATA', 'OURO', 'DIAMANTE', 'LENDAS')
   OR league_at_end IN ('PRATA', 'OURO', 'DIAMANTE', 'LENDAS');
