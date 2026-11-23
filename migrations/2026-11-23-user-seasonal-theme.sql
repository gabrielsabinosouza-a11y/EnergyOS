-- user_settings.seasonal_theme: manual seasonal theme override.
-- NULL or 'auto' = follow the real calendar window; a SeasonId
-- ('halloween' | 'christmas' | 'newyear' | 'easter') forces that theme,
-- decorations and store "Edição Limitada" preview for this user only.
-- Server-side purchase gating still uses the real season window.
alter table user_settings add column if not exists seasonal_theme text;
