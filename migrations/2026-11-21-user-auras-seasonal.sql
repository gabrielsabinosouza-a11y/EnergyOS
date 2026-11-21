-- Allow seasonal aura ids in user_auras. The CHECK constraint whitelists aura
-- types; without this, purchasing a seasonal aura fails with a constraint
-- violation. Seasonal auras remain usable forever once owned.
-- Idempotent; safe to run more than once.

alter table user_auras drop constraint if exists user_auras_aura_type_check;
alter table user_auras add constraint user_auras_aura_type_check check (
  aura_type in (
    'flame','water','thunder','ice','wind','metal','poison','earth',
    'light','shadow','cosmic','crystal',
    -- seasonal (src/config/seasons.ts)
    'jack_o_lantern','ghost','witch_hat',
    'santa_hat','xmas_wreath','xmas_tree',
    'fireworks','champagne','midnight_clock',
    'easter_egg','bunny','easter_basket'
  )
);
