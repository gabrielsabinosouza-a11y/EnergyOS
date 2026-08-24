## energyOS

Rascunho inicial de um dashboard pessoal para acompanhar energia, foco, sono, estudo, treino e consistência.
### Stack inicial

- Next.js + React + TypeScript + Tailwind CSS
- Framer Motion para transições dos painéis
- Firebase para autenticação e serviços do cliente
- Neon/PostgreSQL para perfis, check-ins e tarefas
- Docker Compose para Postgres local

### Rodando localmente

```bash
npm install
copy .env.example .env.local
docker compose up -d postgres
npm run dev
```

Abra `http://localhost:3000`. O schema inicial está em `src/db-schema.sql`.

O rascunho usa dados locais para demonstrar o fluxo. Concluir 50% ou mais das tarefas do dia mantém o streak.

### Próximos passos

- Persistir check-ins e tarefas via API Routes/Server Actions + Neon.
- Conectar login Firebase e perfil autenticado.
- Extrair componentes para compartilhar a linguagem visual com o app React Native.
