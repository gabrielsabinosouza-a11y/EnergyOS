-- store_notification_seen: dismisses the "Novidades sazonais na loja" dot in
-- the sidebar permanently for this user. NULL/false = not seen yet.
alter table user_settings add column if not exists store_notification_seen boolean;
