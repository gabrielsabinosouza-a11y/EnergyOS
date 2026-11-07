-- Migration: Add CHECK constraint to enforce XP potion cap at database level
-- Ensures quantity never exceeds XP_BOOST_MAX_HELD (2) even if application logic fails

alter table user_potions add constraint user_potions_quantity_check check (quantity >= 0 and quantity <= 2) not valid;

-- Validate the constraint (will fail if any existing rows violate it)
alter table user_potions validate constraint user_potions_quantity_check;
