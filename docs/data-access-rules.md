# Regras de acesso — Hábito / Meta / Planejamento

> **Não existem regras do Firestore neste projeto.** O Firestore não é usado:
> `src/lib/firebase.ts` só inicializa o **Auth** (e o Storage do avatar).
> Todos os dados de produto vivem em **PostgreSQL** e são acessados **apenas por
> route handlers** do App Router, que resolvem o usuário a partir do ID token
> verificado. Estas são as regras equivalentes — e como conferi-las.

## Regra 0 — a identidade nunca vem do cliente

`requireAuth(request)` (`src/lib/server-auth.ts`) valida o ID token do Firebase
contra o Identity Toolkit e devolve `profileId`. O corpo/param da requisição
**nunca** escolhe o dono: um `profileId` enviado pelo front é ignorado.

```ts
const { profileId } = await requireAuth(request);   // único dono aceito
```

## Regra 1 — toda query filtra por `profile_id = $1`

Nenhuma tabela nova ou legada pode ser lida/escrita sem o filtro do dono.

| Tabela | Dono | Obrigatório |
|---|---|---|
| `profile_daily_tasks` (HÁBITO) | `profile_id` | `where profile_id = $1` |
| `daily_task_log` (log do hábito) | `profile_id` | `where profile_id = $1` |
| `goals` (META) | `profile_id` | `where profile_id = $1` |
| `planner_items` (PLANEJAMENTO) | `profile_id` | `where profile_id = $1` |
| `planner_completions` (conclusão) | `profile_id` | `where profile_id = $1` |

## Regra 2 — ids de filho não vazam o pai

`daily_task_log` e `planner_completions` são(validados) pelo dono **e** pela
existência do pai, dentro do mesmo escopo:

```sql
-- ✓ leitura de log de hábito
select l.* from daily_task_log l
  join profile_daily_tasks t on t.id = l.task_id
 where l.profile_id = $1 and t.profile_id = $1;

-- ✓ conclusão de item do plano
select c.* from planner_completions c
  join planner_items i on i.id = c.item_id
 where c.profile_id = $1 and i.profile_id = $1;
```

Um `habitId`/`itemId` de outra conta responde **vazio/404** — nunca dados.

## Regra 3 — escritas sempre no escopo do dono

`insert`/`update`/`delete` levam `profile_id = $1` no próprio `where`:

```sql
update planner_items set title = $3
 where id = $2 and profile_id = $1;         -- id de outra conta → 0 linhas → 404
insert into daily_task_log (task_id, profile_id, log_date, is_completed)
values ($1, $2, $3::date, true);           -- profile_id vem do token
```

## Regra 4 — o log é por dia e determinístico

Um registro por hábito/dia e por item/dia (não há cópia por ocorrência):

- `daily_task_log`: PK `(task_id, log_date)` + coluna gerada `doc_id = '12_2026-04-10'`
- `planner_completions`: PK `(item_id, completed_date)` + `doc_id = '7_2026-04-10'`

Isso garante que o histórico do heatmap sobreviva à migração e que a mesma
ocorrência nunca possa ser concluída duas vezes.

## Como auditar (roda contra o banco)

```sql
-- 1. Nenhum registro de logs órfão ou de outro dono
select 'log sem dono' as check, count(*) from daily_task_log l
  where not exists (select 1 from profiles p where p.id = l.profile_id)
union all
select 'conclusão sem pai', count(*) from planner_completions c
  where not exists (select 1 from planner_items i where i.id = c.item_id)
union all
select 'item sem dono', count(*) from planner_items i
  where not exists (select 1 from profiles p where p.id = i.profile_id);

-- 2. Nenhum id de XP pago em nome de outro perfil (mesma checagem do ledger)
select source, source_id, profile_id, count(*)
  from xp_ledger group by 1,2,3 having count(*) > 1;   -- deve devolver 0 linhas
```

## Endurecimento opcional — RLS no Postgres

As regras acima são de aplicação. Para blindar no banco, cada request abre
`begin; set local app.profile_id = '<uid>'; ...` e o app usa um papel sem
`bypassrls`:

```sql
alter table planner_items enable row level security;
alter table planner_completions enable row level security;
alter table daily_task_log enable row level security;
alter table goals enable row level security;
alter table profile_daily_tasks enable row level security;

create policy owner_all on planner_items
  using (profile_id = current_setting('app.profile_id', true))
  with check (profile_id = current_setting('app.profile_id', true));
-- (idem para as demais tabelas)
```

> Requer uma transação por request; hoje as leituras usam um pool com queries
> avulsas, então isto fica para uma fase própria — nada da migração depende disso.