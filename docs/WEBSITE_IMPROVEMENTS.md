# EnergyOS — o que melhorar no website

Running list of known improvements, gaps, and pending work for the web app.
Ordered roughly by impact. Update as items ship.

## 🔴 Pendências bloqueantes / decisões pendentes

- [x] **Arquivos de som ambiente** — `rain.mp3` + `fireplace.mp3` adicionados em
      `public/sounds/` (e copiados para `apps/mobile/assets/sounds/`). Engine
      cai no fallback `.mp3` (ogg não existe). **Pendente**: preencher fonte +
      licença em `public/sounds/CREDITS.md` e validar loop sem gap/cliques.
- [ ] **Cleanup Top 1 Global** — `scripts/cleanup-top1-global.sql` foi escrito
      mas **não executado** (aguardando aprovação + backup `pg_dump`). Sem ele,
      perfis mantêm contagens infladas de "Top 1 Global".
- [ ] **Reverter bônus de 1.000 moedas** — `coin_transactions` com
      `reward_kind='top1_global_unlock'` concedidos por desbloqueios indevidos;
      reversão é débito de moedas → aprovação separada.
- [ ] **Decisão de regra da Liga** — o fix atual exige LENDAS + XP>0 + grupo>1.
      Se a intenção era "#1 de qualquer tier", ajustar `league-reset.ts` e o SQL.

## 🟠 Produto / features

- [ ] **Onboarding dos 19 perfis sem settings** — receberam 100 moedas + Bronze,
      mas `onboarding_completed=false` → verão o tour. Decidir se é desejado.
- [ ] **Som ambiente: teste de escuta** — validar loops sem gap, sem cliques,
      comportamento após reload (sessão restaurada exige 1 clique — autoplay).
- [ ] **Recording de tela** do fluxo foco (iniciar → cancelar graça → concluir →
      desistir) para o checklist de aceite do recurso de sons.
- [ ] **Seasonal theme picker** — revisar se a janela de estações
      (`src/config/seasons.ts`) cobre o calendário BR desejado.
- [ ] **Loja: mais sons desbloqueáveis** — o hook de unlock por moedas está
      previsto (`useAmbientMix`/config); falta UI de loja + preços (não mexer na
      economia sem aprovação).
- [x] **Dica "Arraste o aro"** — contraste corrigido p/ `--text-secondary` (~7.6:1,
      AA) + 11px; sem motion, vale p/ todos os temas sazonais.

## 🟡 Qualidade / engenharia

- [x] **Testes dos sons ambiente** — `src/lib/ambient-sounds/ambient-sounds.test.ts`
      (8 testes: mix/persistência/corrupção + engine com AudioContext mockado).
- [x] **BroadcastChannel** — fallback localStorage/storage-events p/ Safari <15.4
      implementado; comportamento multi-aba documentado em public/sounds/README.md.
- [ ] **Media Session API** — opcional: controles de play/pause na lock screen.
- [ ] **Placer seasonal visual** (gotas de chuva / brilho de lareira no card)
      com `prefers-reduced-motion` — opcional, transform/opacity only.
- [x] **Lint pré-existente** — 2 erros eslint em `src/app/liga/page.tsx`
      corrigidos (purity no countdown + set-state-in-effect no fetch).
- [x] **`schema_migrations` ausente no banco** — baseline aplicado em produção
      (28/28 migrations registradas); fluxo documentado no README.
- [ ] **`.env.vercel` tem `[SENSITIVE]`** — verificação local OK (env-check passa,
      sem hosts divergentes hardcoded); **falta confirmar no dashboard Vercel**.

## 🔵 Mobile (apps/mobile)

- [ ] **Paridade de sons ambiente** — portar rain/fireplace para o foco mobile
      (expo-audio + AsyncStorage mix).
- [ ] Pendências listadas em `apps/mobile/FEATURE_PARITY.md`: Google Sign-In
      nativo, histórico/edição de hábitos, calendário mês/dia no planner,
      controles de sala de foco, restauração confiável de sessão ativa
      (precisa endpoint `GET` de sessão ativa no servidor), push nativo
      (APNs/FCM), upload de mídia nativo.
- [ ] **Áudio ambiente precisa de dev build** se usar módulo nativo fora do
      Expo Go; validar em device real (iOS silent switch, Android audio focus).

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
