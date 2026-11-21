-- Move every seasonal avatar frame into the "Lendária" rarity tier.
-- Seasonal items are identified by season_id (never by rarity), so this is a
-- pure label change: ownership (user_decorations), equipped decorations and
-- prices are untouched.
update avatar_decorations
set rarity = 'legendary'
where season_id is not null
  and rarity <> 'legendary';
