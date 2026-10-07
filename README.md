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

### Ação personalizada de redefinição de senha

Para substituir a página padrão do Firebase:

1. No Firebase Console, abra **Authentication > Templates > Password reset**, selecione editar e, em **Customize action URL**, configure `https://<PRODUCTION_DOMAIN>/auth/action`.
2. Defina o idioma do template como **Português (Brasil)** e ajuste o assunto, por exemplo: **Redefina sua senha do energyOS**.
3. Em **Authentication > Settings > Authorized domains**, confirme que o domínio de produção e `localhost` estão autorizados.
4. Para testar localmente, copie o link recebido por e-mail e substitua o domínio por `http://localhost:<port>`.

Checklist manual: testar um link válido, link expirado, link já utilizado, senha fraca, senhas diferentes, envio sem conexão e layout em viewport móvel. A página trata também ações de verificação e recuperação de e-mail do Firebase.

### Próximos passos

- Persistir check-ins e tarefas via API Routes/Server Actions + Neon.
- Conectar login Firebase e perfil autenticado.
- Extrair componentes para compartilhar a linguagem visual com o app React Native.
