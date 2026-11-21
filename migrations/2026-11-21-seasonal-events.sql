-- Seasonal events: avatar frames + user setting for seasonal themes.
-- Idempotent; safe to run more than once.
--
-- avatar_decorations.season_id links a frame to a season window defined in
-- src/config/seasons.ts (halloween|christmas|newyear|easter). Seasonal frames
-- can only be PURCHASED while their season is active (enforced server-side in
-- src/lib/db/store.ts); owned frames stay equippable forever.
--
-- user_settings.seasonal_themes_enabled toggles the full-app seasonal theme
-- (default ON). The store still shows seasonal items when the theme is off.

alter table avatar_decorations add column if not exists season_id text;
create index if not exists avatar_decorations_season_idx on avatar_decorations(season_id) where season_id is not null;

alter table user_settings add column if not exists seasonal_themes_enabled boolean not null default true;

-- ── Seed seasonal avatar frames ────────────────────────────────────────────
-- Rarity: Épica for 3000-3300 coins, Lendária for the 3500-coin animated frame.

insert into avatar_decorations (id, name, description, image_url, price, rarity, sort_order, season_id) values
  -- Halloween (Oct)
  ('frame_halloween_cobweb',  'Teia de Aranha',   'Teias de aranha nos cantos do anel',            '/assets/seasons/halloween/frames/frame_halloween_cobweb.png',   3000, 'epic',      101, 'halloween'),
  ('frame_halloween_moon',    'Lua Assombrada',   'Lua cheia com brilho espectral',               '/assets/seasons/halloween/frames/frame_halloween_moon.png',     3200, 'epic',      102, 'halloween'),
  ('frame_halloween_bones',   'Ossos',            'Anel feito de ossinhos cruzados',              '/assets/seasons/halloween/frames/frame_halloween_bones.png',    3300, 'epic',      103, 'halloween'),
  ('frame_halloween_flame',   'Chama Roxa',       'Chamas roxas animadas ao redor do avatar',     '/assets/seasons/halloween/frames/frame_halloween_flame.png',    3500, 'legendary', 104, 'halloween'),
  -- Christmas (Nov-Dec)
  ('frame_xmas_candy_cane',   'Bengala Doce',     'Anel de bengalas doces vermelho e branco',     '/assets/seasons/christmas/frames/frame_xmas_candy_cane.png',    3000, 'epic',      101, 'christmas'),
  ('frame_xmas_snowflake',    'Flocos de Neve',   'Flocos de neve crystalline no anel',           '/assets/seasons/christmas/frames/frame_xmas_snowflake.png',     3200, 'epic',      102, 'christmas'),
  ('frame_xmas_holly',        'Azevinho',         'Folhas de azevinho com bagas vermelhas',       '/assets/seasons/christmas/frames/frame_xmas_holly.png',         3300, 'epic',      103, 'christmas'),
  ('frame_xmas_lights',       'Pisca-Pisca',      'Luzes douradas de Natal piscando no anel',     '/assets/seasons/christmas/frames/frame_xmas_lights.png',        3500, 'legendary', 104, 'christmas'),
  -- New Year (Jan-Feb)
  ('frame_newyear_confetti',  'Confete Dourado',   'Confetes dourados caindo no anel',             '/assets/seasons/newyear/frames/frame_newyear_confetti.png',     3000, 'epic',      101, 'newyear'),
  ('frame_newyear_neon',      'Neon Ano Novo',    'Anel neon estilo festa de ano novo',           '/assets/seasons/newyear/frames/frame_newyear_neon.png',         3200, 'epic',      102, 'newyear'),
  ('frame_newyear_sparkler',  'Estrelinha',       'Vela de estrelinha brilhando',                '/assets/seasons/newyear/frames/frame_newyear_sparkler.png',     3300, 'epic',      103, 'newyear'),
  ('frame_newyear_countdown', 'Contagem Regressiva','Números regressivos marcando a virada',      '/assets/seasons/newyear/frames/frame_newyear_countdown.png',    3500, 'legendary', 104, 'newyear'),
  -- Easter (Mar-Apr)
  ('frame_easter_flowers',    'Coroa de Flores',  'Coroa de flores primaveris',                  '/assets/seasons/easter/frames/frame_easter_flowers.png',       3000, 'epic',      101, 'easter'),
  ('frame_easter_eggs',       'Ovos Pastel',      'Ovos de páscoa em tons pastel',               '/assets/seasons/easter/frames/frame_easter_eggs.png',          3200, 'epic',      102, 'easter'),
  ('frame_easter_ears',       'Orelhas de Coelho','Orelhas de coelho sobre o avatar',            '/assets/seasons/easter/frames/frame_easter_ears.png',          3300, 'epic',      103, 'easter'),
  ('frame_easter_butterflies','Borboletas',       'Borboletas e vinhas primaveris animadas',      '/assets/seasons/easter/frames/frame_easter_butterflies.png',   3500, 'legendary', 104, 'easter')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  image_url = excluded.image_url,
  price = excluded.price,
  rarity = excluded.rarity,
  sort_order = excluded.sort_order,
  season_id = excluded.season_id;
