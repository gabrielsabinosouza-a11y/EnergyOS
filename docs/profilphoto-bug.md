# Por que não consigo enviar uma foto de perfil?

Resumo do fluxo, causas prováveis e como corrigir. Este documento é uma análise de
código — nenhuma correção foi aplicada. Número de linhas refere-se a `src/app/perfil/page.tsx`
e `src/lib/db/profiles.ts` na data de escrita.

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

### 2) Limite de tamanho do servidor (~370 KB) vs. 5 MB permitido no cliente
- O cliente deixa **até 5 MB** (`:457`), mas o servidor rejeita data URLs **> 500.000 caracteres
  (~370 KB)** em `src/lib/db/profiles.ts:127-128`:
  ```
  if (photoUrl.startsWith("data:image/")) {
    if (photoUrl.length > 500_000)
      throw new ValidationError("Imagem muito grande (máx. ~370 KB).");
  }
  ```
- Mesmo com o resize para 400 px, fotos "pesadas"/com muito ruído (JPG 0.82) podem passar de 370 KB.
- Resultado: erro no servidor, e o `catch` no cliente vira o genérico "Não foi possível enviar a foto."

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
- **Causa 2:** alinhar o limite. Ou reduzir o upload no cliente (ex.: redimensionar para ~256 px /
  qualidade menor) para ficar folgado abaixo de 370 KB, ou aumentar o limite do servidor.
- **Causa 3:** envolver o decode em `try/catch` e/ou restringir `accept` a `image/jpeg,image/png,image/webp`.
- **Causa 4:** propagar a mensagem real do erro (ex.: `error.message`) no `setPhotoError`.

## Arquivos-chave
- `src/app/perfil/page.tsx` — upload/UI (`uploadPhoto` :454, `fileToDataUrl` :42, input :542).
- `src/app/api/profile/route.ts` — endpoint `PATCH` (`:14-27`).
- `src/lib/db/profiles.ts` — `updatePhotoUrl` e o limite de tamanho (`:124-139`).
- `src/lib/server-auth.ts` — bypass de dev (`:71-81`, log `:95`).
- `src/lib/api-client.ts:73-74` — `api.updatePhotoUrl`.
