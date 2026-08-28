# Como testar o Banner (Loja) com moedas

Para testar visualmente o banner custumizado, você precisa (a) saldo de moedas
para desbloquear e (b) o banner desbloqueado + uma URL de imagem. Abaixo o passo a passo
e os SQLs prontos para rodar **no seu banco de dev/teste** (não em produção).

> ⚠️ Isso grava direto no banco. Rode apenas em ambiente de desenvolvimento/teste.

## Contexto do sistema (código)
- Saldo de moedas fica em `user_settings.coins` (ver `src/db-schema.sql:81`).
- Banner desbloqueado = `profiles.has_custom_banner` (`src/db-schema.sql:472`),
  imagem em `profiles.banner_image_url`.
- Custo para desbloquear: `BANNER_COST = 1500` (`src/lib/db/store.ts:118`).
- Flow na loja: `unlockBanner()` (`store.ts:142`) desconta 1500 e seta `has_custom_banner=true`;
  `updateBannerImage()` (`store.ts:179`) grava a URL (máx. 2000 chars).

## Passo 0 — descubra os IDs dos perfis
O `profile_id` é o UID do Firebase (ou o hash do id de dev). Para achar:

```sql
select id, display_name, email from profiles order by last_active_at desc nulls last;
```

## Passo 1 — adicione moedas (coloque seus IDs nos placeholders)

```sql
-- Troque 'SEU_ID' e 'ID_DO_FABAO' pelos IDs reais dos perfis.
-- Cria/atualiza a linha do saldo com 20.000 moedas (acima dos 1500 do banner).

insert into user_settings (profile_id, notifications_enabled, preferred_theme, sleep_time, focus_time, coins)
values
  ('SEU_ID',    true, 'dark', null, null, 20000),
  ('ID_DO_FABAO', true, 'dark', null, null, 20000)
on conflict (profile_id)
do update set coins = excluded.coins;
```

## Passo 2 — desbloqueia o banner (dispensa gastar na loja)

```sql
update profiles set has_custom_banner = true
where id in ('SEU_ID', 'ID_DO_FABAO');
```

> Alternativa: se preferir testar o fluxo real da loja, **não** rode o Passo 2 e,
> com as moedas do Passo 1, clique em "Desbloquear banner" (custa 1500) na loja.

## Passo 3 — defina a imagem do banner
Na tela do perfil/loja, depois de desbloqueado, use o campo de URL do banner.
URLs válidas: `http(s)://...` ou `data:image/...`, com até 2000 caracteres
(`store.ts:184`). Se preferir via SQL direto:

```sql
update profiles set banner_image_url = 'https://exemplo.com/sua-banner.jpg'
where id = 'SEU_ID';
```

## Conferir
```sql
select p.id, p.display_name, p.has_custom_banner, p.banner_image_url, s.coins
from profiles p
left join user_settings s on s.profile_id = p.id
where p.id in ('SEU_ID', 'ID_DO_FABAO');
```

## Reverter (remover o que foi feito)
```sql
-- zera moedas extras (opcional) e remove o banner
update user_settings set coins = 0 where profile_id in ('SEU_ID', 'ID_DO_FABAO');
update profiles set has_custom_banner = false, banner_image_url = null
where id in ('SEU_ID', 'ID_DO_FABAO');
```

---
Quer que eu transforme isso num script npm (`npm run grant-coins -- --id=... --coins=20000`) para facilitar repetir o teste? Se sim, me avisa que eu adiciono.
