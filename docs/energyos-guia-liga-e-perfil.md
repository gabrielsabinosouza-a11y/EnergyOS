---
title: EnergyOS — Guia da Liga (Liga) e Perfil
created: 2026-08-28
tags: [energyos, liga, league, perfil, moedas]
---

# EnergyOS — Guia da página Liga e Perfil

> Doc de referência para entender a **página Liga** (rankings semanais, tiers,
> medalhas de pódio e recompensas em moedas) e o **upload de foto de perfil**.
> Estilo de escrita: documento leve para ler no Obsidian.

---

## Visão geral do projeto

- **Stack:** Next.js (App Router) · React 19 · TypeScript · Tailwind v4 · Framer Motion · Firebase Auth · PostgreSQL (Neon).
- **Idioma:** Português brasileiro.
- Código do banco fica em `src/lib/db/*.ts`; schema de referência em `src/db-schema.sql`.
- As páginas ficam em `src/app/<rota>/page.tsx` (componentes client com `"use client"`), chamam a API via `src/lib/api-client.ts` (`api.xxx()`), que bate em `src/app/api/<recurso>/route.ts`, que usa as funções de `src/lib/db/*.ts`.

---

## Duas implementações de Liga — IMPORTANTE

> ⚠️ Existem **DOIS** sistemas de liga no código. Na prática o *novo* (com Ouro,
> Diamante, Lendas) é o que a página `/liga` usa. O *antigo* está órfão.

### Ligas existentes

| Sistema | Arquivo | Tiers | A página `/liga` usa? |
|---|---|---|---|
| **Antigo** | `src/lib/db/league.ts` | faisca → chama → aura → nucleo (tabelas `league_standings`, `league_entries`) | ❌ Não (ficou de legado) |
| **Novo** ✅ | `src/lib/db/league-new.ts` | BRONZE → PRATA → OURO → DIAMANTE → LENDAS (tabelas `league_groups`, `league_group_members`) | ✅ Sim |

O fluxo da página nova:

1. `src/app/liga/page.tsx` (UI) chama `api.getLeagueNew()`.
2. `src/app/api/league-new/route.ts` → `runWeeklyLeagueReset()` (settlement semanal) + `getUserLeagueSnapshot()`.
3. Lógica de DB em `src/lib/db/league-new.ts`.

---

## Tiers (liga nova)

Definidos em `src/types/index.ts` e `src/lib/league-meta.ts` (config visual no front).

| Tier | Cor (front) | Promoção (Top N sobe) |
|---|---|---|
| BRONZE | `#cd7f32` | Top 10 → PRATA |
| PRATA | `#c0c0c0` | Top 10 → OURO |
| OURO | `#ffd700` | Top 7 → DIAMANTE |
| DIAMANTE | `#00bfff` | Top 5 → LENDAS |
| LENDAS | `#ff69b4` | — (topo, sem subir) |

Regras em `league-new.ts`:
- `PROMOTION_CUTOFFS` — quantos do topo sobem por tier.
- `DEMOTION_COUNT = 3` — os últimos 3 caem de tier.
- `LEGENDS_TOP_N = 5`, `LEGENDS_MAX_SIZE = 20` — como se forma o grupo Lendas.

Dados: cada usuário vira membro de um grupo da semana; `weekly_xp` é somado via
`addLeagueXP()` (chamado quando o foco gera XP). Ao fim da semana o `runWeeklyLeagueReset()`
ranqueia, decide promoção/rebaixamento e paga as moedas.

---

## Medalhas de pódio (1º, 2º, 3º)

- Imagens usadas para as posições ficam em **`public/places/`**:
  - `first_place.png`, `second_place.png`, `third_place.png`
- No ranking da semana (`src/app/liga/page.tsx` → função `MedalBadge`), as posições
  **1, 2 e 3** mostram a imagem de medalha correspondente; a partir da posição 4
  mostra apenas o número.

### O que foi feito
- `MedalBadge` agora usa as imagens `/places/first_place.png`, `/second_place.png`,
  `/third_place.png` em vez de um círculo colorido.
- Ícone do tier atual (topo da página) ficou **maior** (`h-24 w-24`, imagem 72px).
- Cada usuário no ranking vê sua medalha de posição na linha dele.

---

## Recompensas em moedas (pódio semanal)

Regra implementada em `league-new.ts` → função `runWeeklyLeagueReset()`:

- Ao fim da semana, quem termina entre os **Top 3** do grupo ganha moedas:
  - **1º lugar = 150 moedas**
  - **2º lugar = 100 moedas**
  - **3º lugar = 75 moedas**
  - (Lendas usa o prêmio maior próprio: 500 / 300 / 150.)
- Constantes: `REGULAR_TIER_COIN_REWARDS = [150, 100, 75]` e
  `LEGENDS_LEAGUE_REWARDS = [500, 300, 150]` em `league-new.ts`.

### ⚠️ Erro de destino das moedas (corrigido)
- Antes, a lógica gravava em `profiles.coin_balance` — **tabela que a loja não lê**.
- A loja lê **`user_settings.coins`** (ver `getCoinBalance()` em `src/lib/db/store.ts:505`).
- Corrigido: a premiação agora usa o helper **`addCoins()`** de `src/lib/db/settings.ts`,
  que credita corretamente em `user_settings.coins` (mesmo caminho usado pelas missões diárias).
- Resultado: o usuário que ficar no pódio passa a ver as moedas **de verdade na loja**.
- A UI da página `/liga` também passou a exibir um bloco "Recompensas do pódio"
  mostrando os prêmios 1º/2º/3º (150 / 100 / 75).

### Quando o pagamento roda
- `runWeeklyLeagueReset()` é chamado no GET de `/api/league-new` (é **idempotente**:
  só age quando a semana virou). Também existe `POST /api/league-new` como gatilho manual/cron.
- ⚠️ Se for rodar em produção apenas com o GET, demora a consolidar; o ideal é um
  cron/job chamando o `POST` no fechamento da semana.

---

## Perfil — upload de foto

### Onde está
- `src/app/perfil/page.tsx` → função `uploadPhoto()`.
- Upload vai para o **Cloudinary** (unsigned, por `upload_preset`).
- Env vars necessárias (em `.env`): `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`,
  `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.

### 🐞 Bug encontrado e corrigido
- **Sintoma:** "não consigo colocar foto de perfil" (aparece "Não foi possível enviar a foto.").
- **Causa:** a URL de upload estava **sem o `v1_`**:
  - ❌ Antes: `https://api.cloudinary.com/v1/<cloud>/image/upload`
  - ✅ Correto: `https://api.cloudinary.com/v1_/<cloud>/image/upload`
- O endpoint correto do Cloudinary para upload unsigned é `https://api.cloudinary.com/v1_/<cloud_name>/<resource_type>/upload`.
- A loja (`src/app/loja/page.tsx` → banner) **já usava o padrão certo** (`v1_/`),
  por isso o banner funcionava e a foto não.
- **Correção:** ajustada a URL em `perfil/page.tsx` para `v1_/`.

### Fluxo pós-upload
1. Envia para o Cloudinary → recebe `secure_url`.
2. `updateProfile(auth.currentUser, { photoURL })` (Firebase).
3. `api.updatePhotoUrl(secure_url)` → `PATCH /api/profile` → `updatePhotoUrl()` em `src/lib/db/profiles.ts`.
4. `photoUrl` é exibida no avatar (`src/app/perfil/page.tsx`).

---

## Como verificar / rodar

- Typecheck: `npx tsc --noEmit`
- Lint (só arquivos alterados): `npx eslint src/app/liga/page.tsx src/app/perfil/page.tsx src/lib/db/league-new.ts`
- Rodar dev: `npm run dev`
- ⚠️ O lint da página da Liga já tinha 2 erros **pré-existentes** (impureza em `useCountdown`
  e setState síncrono no effect) que não são desta mudança.

---

## Arquivos-chave

| Assunto | Arquivo |
|---|---|
| Página Liga | `src/app/liga/page.tsx` |
| Lógica da liga nova | `src/lib/db/league-new.ts` |
| Helper de moedas | `src/lib/db/settings.ts` (`addCoins`) |
| Saldo de moedas da loja | `src/lib/db/store.ts` (`getCoinBalance`) |
| Perfil (upload de foto) | `src/app/perfil/page.tsx` |
| Persistência do perfil | `src/lib/db/profiles.ts` |
| Schema (referência) | `src/db-schema.sql` |
| Medalhas de pódio | `public/places/*.png` |
| Ícones de tier | `public/leaderboard/*.png` |
