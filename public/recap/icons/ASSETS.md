# Artes 3D do Recap

Esta pasta recebe as artes 3D (PNG) usadas nos slides do modal de Recap
(`src/components/dashboard/monthly-recap-premium.tsx`).

| Arquivo                | Slide     | Visual         | Cor de destaque |
| ---------------------- | --------- | -------------- | ---------------- |
| `recap-foco.png`       | Foco      | Cronômetro    | `#5CC8FF` (ciano) |
| `recap-sequencia.png`  | Sequência | Chama         | `#FFB067` (âmbar) |
| `recap-jardim.png`     | Jardim    | Raio/energia  | `#3DDC84` (verde)  |

## Regras

- PNG com fundo **transparente**,Quadrado (ex.: 512×512) e o objeto centralizado.
- O arquivo é **opcional**: enquanto não existir, o componente usa o ícone line
  original (lucide: `Timer`, `Flame`, `Zap`) como fallback — nada quebra.
- A arte é exibida em ~92px dentro do slide e em ~16px nos cards do resumo
  final; use traços grossos para ficar legível nos dois tamanhos.
- O PNG exportado (download/compartilhar) também usa estas artes; sem elas, o
  export desenha um marcador circular na cor do slide.
