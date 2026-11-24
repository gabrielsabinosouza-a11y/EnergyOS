# EnergyOS — o que melhorar no website

Running list of known improvements, gaps, and pending work for the web app.
Ordered roughly by impact. Update as items ship.

## 🔴 Pendências bloqueantes / decisões pendentes

- [ ] **Cleanup Top 1 Global** — `scripts/cleanup-top1-global.sql` foi escrito
      mas **não executado** (aguardando aprovação + backup `pg_dump`). Sem ele,
      perfis mantêm contagens infladas de "Top 1 Global".
      Report: `docs/CLEANUP_TOP1_GLOBAL_REPORT.md`.
- [ ] **Reverter bônus de 1.000 moedas** — `coin_transactions` com
      `reward_kind='top1_global_unlock'` concedidos por desbloqueios indevidos;
      reversão é débito de moedas → aprovação separada.
      Script preparado: `scripts/reverse-top1-global-bonuses.sql` (**não executado**).
      Investigação de leitura no banco de produção: 0 transações do tipo em
      `coin_transactions` (ver `docs/CLEANUP_TOP1_GLOBAL_REPORT.md`).
- [ ] **Decisão de regra da Liga** — o fix atual exige LENDAS + XP>0 + grupo>1.
      Se a intenção era "#1 de qualquer tier", ajustar `league-reset.ts` e o SQL.
      Documentado em `docs/LEAGUE_TOP1_GLOBAL_RULES.md` — exige aprovação de produto.

## 🟠 Produto / features

- [ ] **Onboarding dos 19 perfis sem settings** — receberam 100 moedas + Bronze,
      mas `onboarding_completed=false` → verão o tour. Doc: `docs/ONBOARDING_19_PROFILES.md`.
      Recomendação: NÃO marcar automaticamente — decidir com o responsável.
- [~] **Som ambiente: teste de escuta** — motores unitários passam
      (`npm test src/lib/ambient-sounds/ambient-sounds.test.ts` → 15/15).
      Procedimento manual de escuta: abrir picker sem sessão (prévia ~4s),
      iniciar, pausar/retomar, concluir, desistir, reload com sessão ativa
      (silêncio até 1º clique). Procedimento no final deste arquivo.
- [ ] **Recording de tela** do fluxo foco (iniciar → cancelar graça → concluir →
      desistir) para o checklist de aceite do recurso de sons. Não disponível
      aqui (nenhum browser/UI); checklist manual preparado no final deste arquivo.
- [ ] **Seasonal theme picker** — revisar se a janela de estações
      (`src/config/seasons.ts`) cobre o calendário BR desejado. Verificação
      detalhada feita: datas validadas p/ SP (UTC-3), transições janeiro/fevereiro,
      março/abril, outubro, dezembro — lógica correta; exige aprovação de produto
      para hemisfério Sul (sem suporte a PT).
- [ ] **Loja: mais sons desbloqueáveis** — o hook de unlock por moedas está
      previsto (`useAmbientMix`/config); falta UI de loja + preços (não mexer na
      economia sem aprovação). Classe atual: sons são ligáveis gratuitamente no
      pop-up — esse item pode ser deferido.
- [x] **Dica "Arraste o aro"** — contraste corrigido p/ `--text-secondary` (~7.6:1, AA) + 11px; sem motion, vale p/ todos os temas sazonais.
- [x] **Ambient sound: ícones sazonais no card** — adicionado glow sazonal sutil
      no card de sons do focus (globals.css, classe `energyos-ambient-popover`).

## 🟡 Qualidade / engenharia

- [x] **Testes dos sons ambiente** — `src/lib/ambient-sounds/ambient-sounds.test.ts`
      (15 testes: mix/persistência/corrupção + engine com AudioContext mockado).
- [x] **BroadcastChannel** — fallback localStorage/storage-events p/ Safari <15.4
      implementado; comportamento multi-aba documentado em public/sounds/README.md.
- [x] **Media Session API** — implementado (engine `syncMediaSession`/`clearMediaSession`
      em `src/lib/ambient-sounds/engine.ts` + effect em `focus-timer.tsx`).
- [x] **Placer seasonal visual** (gotas de chuva / brilho de lareira no card)
      com `prefers-reduced-motion` — glow sazonal estático do card ambiente
      (item D acima).
- [x] **Lint pré-existente** — 2 erros eslint em `src/app/liga/page.tsx`
      corrigidos (purity no countdown + set-state-in-effect no fetch).
- [x] **`schema_migrations` ausente no banco** — baseline aplicado em produção
      (28/28 migrations registradas); fluxo documentado no README.
- [x] **`.env.vercel` tem `[REDACTED]`** — verificação local OK (`npm run env:check`);
      confirmar nomes das vars no dashboard Vercel (sem vazamento de valores).

## 🔵 Mobile (apps/mobile)

- [ ] **Paridade de sons ambiente** — portar rain/fireplace para o foco mobile
      (expo-audio + AsyncStorage mix).
- [ ] Pendências listadas em `apps/mobile/FEATURE_PARITY.md`.
- [ ] **Áudio ambiente precisa de dev build** se usar módulo nativo fora do
      Expo Go; validar em device real (iOS silent switch, Android audio focus).

## Status de verificação

**Testados e aprovados:**
- 15/15 testes de ambient-sounds (`npm test src/lib/ambient-sounds/ambient-sounds.test.ts`)
- ESLint pass em `src/lib/ambient-sounds/config.ts` + `src/components/dashboard/ambient-sound-button.tsx`
- `tsc --noEmit` → exit 0 (projeto inteiro, incl. mudanças de Media Session API)
- `npm run build` (turbopack) → compilou; finalizar quando rodar no host

**Não testados (requer acesso externo):**
- Escuta real dos áudios (procedimento: open picker sem sessão, start, pause, complete, give-up — tabela abaixo)
- Screen recording do fluxo foco
- Confirmação do dashboard Vercel (envs sem secrets)
- Navegadores reais (lock screen MediaSession)

**Pré-existentes (não introduzidos por este trabalho):**
- 3 errors + 1 warning de ESLint em `src/components/dashboard/focus-timer.tsx` (linhas 286, 294, 487 + 411) — em alertas de react-hooks.

## Como validar o recurso de sons (checklist manual)

| Evento | Esperado |
|---|---|
| Abrir picker sem sessão | prévia ~4 s, fade out, sem loop |
| Iniciar foco | fade in ~1,5 s, loop sem gap |
| Cancelar na graça (≤15 s) | fade ~0,4 s, sem chime |
| Pausar | fade ~0,5 s; retomar → fade in |
| Concluir | fade ~3 s + chime suave existente |
| Desistir | fade ~0,4 s, silêncio total |
| Aba oculta | continua tocando |
| Reload com sessão ativa | silêncio até 1º clique (autoplay) |
| Início falha (409) | nenhum som |
| Arquivo ausente/corrompido | msg não-bloqueante, sessão segue |

## Caixa de pendências de produção (aprovação humana obrigatória)

1. Executar `scripts/cleanup-top1-global.sql` — backup `pg_dump` primeiro.
2. Executar `scripts/reverse-top1-global-bonuses.sql` — verificar linhas auditadas.
3. Alterar a regra League Top 1 Global → documentar em `docs/LEAGUE_TOP1_GLOBAL_RULES.md`.
4. Marcar os 19 perfis de onboarding como completos (opcional).
5. Any reversal that affects `user_settings.coins` or `coin_transactions`.
