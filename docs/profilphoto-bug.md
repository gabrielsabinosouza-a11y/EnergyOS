# Por que não consigo enviar uma foto de perfil?

Resumo do fluxo, causas prováveis e como corrigir. Número de linhas refere-se a
`src/app/perfil/page.tsx` e `src/lib/db/profiles.ts` na data de escrita.

> ✅ Atualização: o limite de envio de foto de perfil foi **aumentado de ~370 KB para 7 MB**
> (cliente `perfil/page.tsx:461` e servidor `profiles.ts:127-128`). Ver seção "7 MB aplicado".

## Fluxo atual (como o envio acontece hoje)

1. Usuário escolhe uma imagem (`<input type="file" accept="image/*">`, `perfil/page.tsx:542-549`).
2. `uploadPhoto()` (`perfil/page.tsx:454`) valida: precisa ser `image/*` e **≤ 5 MB** (`:457`).
3. `fileToDataUrl()` (`perfil/page.tsx:42`) redimensiona para **máx. 400 px** e converte para
   base64 (`canvas.toDataURL("image/jpeg", 0.82)`).
4. Envia para o Firebase primeiro: `updateProfile(auth.currentUser, { photoURL: photoUrl })` (`:465`).
5. Depois grava no seu banco: `api.updatePhotoUrl(photoUrl)` → `PATCH /api/profile` → `updatePhotoUrl` no Postgres (`:466`).

Qualquer falha cai no `catch` de `:470`, que mostra apenas: **"Não foi possível enviar a foto."**

---

## Causas prováveis (em ordem de probabilidade)

### 1) Sessão via "Dev Bypass" — não há usuário real do Firebase (mais provável)
- `uploadPhoto` retorna cedo se `!auth?.currentUser` (`:456`), ou chama
  `updateProfile(...)` (`:465`) — os dois exigem login **real** no Firebase Auth.
- O backend aceita bypass de auth em dev: `devBypassProfileId()` em
  `src/lib/server-auth.ts:71-81` (quando `AUTH_ALLOW_UNVERIFIED=true` e não-produção).
- Se a app está rodando no modo dev bypass, **não existe** `currentUser` de verdade:
  - o `updateProfile` falha/lança, e como ele roda **antes** do update no banco (`:465` antes de `:466`),
    nada é gravado; ou
  - o `currentUser` é null e a função nem chega a enviar.
- Sintoma típico: o avatar não muda e aparece "Não foi possível enviar a foto." (ou nada acontece).

### 2) Limite de tamanho do servidor vs. limite permitido no cliente
- O cliente permitia **até 5 MB** (`:457`), mas o servidor rejeitava data URLs **> 500.000 caracteres
  (~370 KB)** em `src/lib/db/profiles.ts:127-128` — daí imagens grandes falharem
  ("Imagem muito grande (máx. ~370 KB)") mesmo com o resize para 400 px.
- ⚠️ Mesmo limpo, o `catch` no cliente vira o genérico "Não foi possível enviar a foto."

> ### 🐞 Cloudinary NÃO é a foto de perfil
> O erro `https://api.cloudinary.com/v1_/dch7w7ncj/image/upload` (404 + CORS) vem do
> **banner da Loja** (`src/app/loja/page.tsx:634-671`), não do perfil.
> O perfil usa base64 (canvas) direto no Postgres — não chama Cloudinary.
> O 404 do Cloudinary significa nuvem/preset inválido ou preset não habilitado para upload
> unsigned (Cloudinary omite o header CORS nesses erros, gerando o "CORS + 404").

### 3) `createImageBitmap`/canvas falha em alguns formatos
- `fileToDataUrl` usa `createImageBitmap(file)` (`:43`). Isso **lança** para:
  - SVG (alguns navegadores), HEIC/HEIF (iPhone), ou formatos exóticos;
  - arquivos corrompidos.
- Mesmo com `accept="image/*"`, alguns formatos vêm marcados como `image/*` e depois quebram no decode.

### 4) O erro real é escondido do usuário
- O `catch` de `:470` é genérico e não mostra a mensagem do servidor, então não dá para saber
  a causa exata pelo app.

---

## Como diagnosticar / corrigir

**Ver rápido (1 min):**
1. Abra o DevTools → Console. O backend loga `[auth] Using dev bypass profile:` em
   `server-auth.ts:95` quando está em bypass.
2. Se estiver em bypass, é a Causa 1: para testar o upload de verdade é preciso login real no Firebase.

**Correções por causa:**
- **Causa 1:** não chamar `updateProfile` do Firebase quando não houver `currentUser` real;
  gravar só no banco (`api.updatePhotoUrl`) e propagar a imagem apenas pelo DB.
- **Causa 2:** ✅ aplicado — limite alto para 7 MB (cliente e servidor). Ver "7 MB aplicado" abaixo.
- **Causa 3:** envolver o decode em `try/catch` e/ou restringir `accept` a `image/jpeg,image/png,image/webp`.
- **Causa 4:** propagar a mensagem real do erro (ex.: `error.message`) no `setPhotoError`.

## Arquivos-chave
- `src/app/perfil/page.tsx` — upload/UI (`uploadPhoto` :458, `fileToDataUrl` :42, input :593).
- `src/app/api/profile/route.ts` — endpoint `PATCH` (`:14-27`).
- `src/lib/db/profiles.ts` — `updatePhotoUrl` e o limite de tamanho (`:124-139`).
- `src/lib/server-auth.ts` — bypass de dev (`:71-81`, log `:95`).
- `src/lib/api-client.ts:73-74` — `api.updatePhotoUrl`.

---

## 7 MB aplicado (esta mudança)

**Shift climático:** a foto de perfil segue o fluxo de **base64 (canvas)** direto pro Postgres —
**não passa pelo Cloudinary**. Por isso, o limite de 7 MB é **código**, não configuração de DB.

O que mudou:
- `src/app/perfil/page.tsx:461` → cliente aceita arquivos de **até 7 MB**
  (`file.size > 7 * 1024 * 1024`).
- `src/lib/db/profiles.ts:127-128` → servidor aceita data URLs de **até ~9.400.000 chars** (~7 MB
  em base64, fator ~1,33):
  ```ts
  if (photoUrl.length > 9_400_000)
    throw new ValidationError("Imagem muito grande (máx. ~7 MB).");
  ```

**Não há comando de DB para isso** — o limite é uma constante no código. Se quiser mudar de novo,
edite esses dois pontos. Observação: o upload ainda redimensiona para **400 px** antes de gravar,
então o valor armazenado continua pequeno; o limite maior permite arquivos-fonte maiores.
