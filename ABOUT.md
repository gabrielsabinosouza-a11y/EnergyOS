# energyOS

**Seu ritmo. Sua energia. Sua vida.**

energyOS é um aplicativo pessoal de produtividade e bem-estar que transforma a rotina diária em sinais claros. Ele acompanha como você dorme, estuda, treino e realiza — tudo em um único painel com estética dark/futurista, glassmorphism e glow.

O produto nasceu da ideia de que produtividade não deve ser sinônimo de pressão. Aqui, consistência é recompensada com pequenas vitórias: um streak que cresce, XP que acumula, e uma visualização clara de que você está no caminho certo — mesmo nos dias mais difíceis.

---

## O que o energyOS faz

### Check-in diário
Um painel rápido perguntando como você dormiu. O app usa essa informação (junto com dados de estudo e treino) para calcular métricas semanais, tendências e insights personalizados.

### Tarefas do dia
Lista de tarefas com categorias (Foco, Corpo, Mente, Ordem, Energia). Completar 50% ou mais das tarefas mantém o streak ativo. Cada tarefa concluída gera XP.

### Metas e hábitos
Metas de longo prazo (sono, estudo, treino, saúde, foco) com barras de progresso e hábitos recorrentes vinculados. Acompanhe o progresso diário e semanal.

### Kanban
Quadro simples (A Fazer / Fazendo / Feito) com drag-and-drop para organizar tarefas de maior escala. Cards podem ser promovidos a partir de tarefas diárias.

### Plano da semana
Visão semanal em grade compacta mostrando o que está planejado por dia. Itens podem existir como blocos livres ou estar vinculados a tarefas existentes.

### Timer de foco
Cronômetro estilo Pomodoro (blocos de 25min) que persiste ao navegar entre páginas. Cada bloco completo gera XP, com cap diário para evitar grind.

### Gamificação
Sistema de XP integrado em todas as seções:
- Tarefa concluída: **10 XP**
- Card no Kanban movido para "Feito": **15 XP** (uma única vez por card)
- Sessão de foco: **5 XP** por bloco de 25min (máx. 8 blocos/dia)
- Bônus de streak: **+10 XP** a cada 7 dias consecutivos

### Relatórios
Gráficos de sono, tempo de estudo, conclusão de tarefas e progresso de metas — com comparativos semana a semana.

### Insights
Análises automáticas geradas a partir dos seus check-ins e padrões de comportamento.

---

## Identidade visual

- **Tema escuro** com paleta azul-ciano (`#71d4ff`), roxo (`#b69cff`), laranja (`#ffb86b`), verde (`#6bffb8`) e coral (`#ff9f6b`)
- **Glassmorphism** em painéis e cards
- **Glow** em elementos interativos e barras de progresso
- **Tema claro** disponível, mantendo a mesma identidade com paleta invertida
- **Saudação dinâmica** que muda conforme o horário do dispositivo (Bom dia / Boa tarde / Boa noite)

---

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| Animações | Framer Motion |
| Gráficos | Recharts |
| Drag-and-drop | @dnd-kit |
| Ícones | Lucide React |
| Autenticação | Firebase Auth (Google + E-mail/Senha) |
| Banco de dados | PostgreSQL via Neon |
| Ícones pixelados | Assets locais (`/public/icons_8bits/`) |

---

## Estrutura do projeto

```
src/
├── app/                    # App Router (páginas + API routes)
│   ├── (auth)/            # Login e cadastro
│   ├── api/               # Endpoints REST
│   ├── configuracoes/     # Configurações do usuário
│   ├── dashboard/         # Painel principal
│   ├── metas/             # Metas e hábitos
│   ├── perfil/            # Perfil do usuário
│   └── relatorio/         # Relatórios e gráficos
├── components/            # Componentes React
│   ├── dashboard/         # Componentes do dashboard
│   ├── ui.tsx             # Primitivas de UI
│   ├── app-shell.tsx      # Layout wrapper com sidebar
│   └── navigation.tsx     # Sidebar e header
├── lib/                   # Lógica de negócio
│   ├── db/                # Operações no banco (checkins, tasks, goals, kanban, focus, xp)
│   ├── api-client.ts      # Cliente API com injeção automática de token
│   ├── theme-provider.tsx # Contexto de tema (system/light/dark)
│   └── auth-context.tsx   # Contexto de autenticação Firebase
├── types/index.ts         # Definições de tipo TypeScript
└── db-schema.sql          # Schema do PostgreSQL
```

---

## Como rodar

```bash
npm install
cp .env.example .env.local    # configure Firebase + Neon
docker compose up -d postgres  # ou use Neon direto
npm run db:init
npm run dev
```

Abra `http://localhost:3000`.

---

## Filosofia

O energyOS não é um app de produtividade no sentido tradicional. Ele não mede quanto você produziu — ele mede **como você está**. O sono importa. O treino importa. O estudo importa. Mas acima de tudo, a **consistência** importa.

Um streak de 7 dias não significa que você foi perfeito. Significa que, por 7 dias seguidos, você tentou. E isso é o que o energyOS celebra.

> *Feito para pessoas que querem constância, não correria.*
