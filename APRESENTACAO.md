# 1. EnergyOS — Apresentação: Timer de Foco com Crescimento de Árvore

O **timer de foco** ganhou um crescimento de árvore, inspirado no jogo [Forest](https://forestapp.cc/): a aura equipada no início da sessão funciona como a árvore — cresce, fica completa no jardim e vira uma morta se o usuário desistir.

# 2. Etapas do crescimento do timer (aurora)

3 estágios de crescimento, ao longo do tempo da sessão:

- **Begin** — início da sessão (0% a 32.9%)
- **Mid** — sessão em curso (33%+)
- **Full** — sessão concluída (100%)
- **Die** — o usuário desistiu (abandono)

`getGrowthStage(elapsedMs, totalMs)` é pura: `STAGE_MID_THRESHOLD = 0.33`.

# 3. Ancoragem: tempo do servidor + aura do equipamento

- Cálculo a partir do `startedAt` do servidor (tempo do servidor) — sobrevive a reload, troca de aba e throttle.
- A aura usada é a **aura equipada na hora do início** — persistida no `energy_type` do `focus_sessions` (mudar o equipamento depois não altera a sessão em curso).
- Stage restoration: na reabilitação com sessão ativa, o stage correto é restaurado pela wall-clock.

# 4. Guardrails: aura do equipe, cancel grátis, wall-clock

- Cancellar dentro do **grácil de 15s** = grátis: nada salvo no jardim, nenhuma aura morta.
- `prefers-reduced-motion`: animações suaves, sem partículas.
- Stages são sempre calculados de wall-clock (não de contador do cliente).

# 5. Give-up (desistir) — duas trilhas

1. **Grace period:** Cancelar = grátis. Nada salvo.
2. Após o grace, "Desistir" → confirm → `endFocusSession(..., "gave_up")` → entrada Dead no jardim (`{auraId}_die`).

# 6. Jardim (Meu Jardim)

Entradas armazenam: `auraId`, `status` ("completed" | "gave_up"), `duration`, `date` (plantedAt).

- Completada → `{auraId}_full.png` (mantém o badge "✓ Completo" antigo).
- Abandonada → `{auraId}_die.png` com visual desaturado (grayscale).
- Visual legado "withered" continua exibindo como morto.

# 7. Animações do timer

- Begin → Mid → Full: **crossfade + pop (scale) + pequenas partículas**.
- Completo: **celebração maior**.
- Give-up: **shake + crossfade para die**.
- Desenvolvedor: `?timerSpeed=N` (só em dev) acelera o timer para testar etápis.

# 8. Avatares sazonais — Frame PNGs normalizados

Aura de Natal (Bengala Doce, Flocos de Neve, Azevinho, Pisca-Pisca) tinha o ring ~30% menor que as frames SVG. Normalizou-se: trilha as imagens para o ring de referência (`outerDiameter = 100%` do canvas 1024), recentra e reposiciona dentro da borda (margem 6px).

Verificação (`npm run frames:verify`) — 6 checks, com lugar para decisões: "ring too thick" dos meios. Código: `scripts/frames-measure.mjs`, `scripts/frames-normalize.mjs`, `scripts/frames-verify.mjs`, backup em `public/assets/seasons/christmas/frames/_originals/`.

# 9. Stages & reports

Os estágios do timer (cliente) são:

- begin [0%, 33%) — entre 0% e 32.9%
- mid [33%, 100%) — de 33% até 99.9%
- full (100%) — sessão concluída
- die — você desistiu (give-up)

O estágio "full" só é atingido quando a sessão é **concluída** — sessões canceladas antes nunca ficam "full".

# 10. Plataforma: EnergyOS — o app da aura

O **EnergyOS** é a plataforma onde você foca, onde as auras crescem e onde o jardim de auras amadurece.

[![EnergyOS QR](qr-energyos.svg)](https://energyos-tan.vercel.app)

Url direta: https://energyos-tan.vercel.app

### Obrigado(a) 🌲

Obrigado por fazer parte desta construção! 🚀
