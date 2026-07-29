# CLAUDE.md — apps/api (backend Nest.js)

Convenções do backend. **Leia antes o [`CLAUDE.md` da raiz](../../CLAUDE.md)** — ESM/`.js`,
UUIDv7, dinheiro-como-string, fonte de verdade em `@buffet/shared`, copy pt-BR e tags `RF##/RNF##`
valem aqui e **não** se repetem neste arquivo.

Nest.js 11, REST, ESM. A API é a **fonte única de sessão/roles** (Better-Auth); o front consome dela.

## Anatomia de um módulo de feature

Um domínio = **uma pasta com três arquivos** (kebab-case, nome = pasta) + teste colocado:

```
items/
  items.module.ts       @Module({ controllers: [ItemsController], providers: [ItemsService] })
  items.controller.ts   rotas HTTP
  items.service.ts       regra de negócio + acesso a dados
  items.service.test.ts  (opcional) teste colocado
```

O módulo é mínimo — não precisa de `imports` porque os tokens `DB` e `AUTH` são `@Global`.
Registre o módulo em [`src/app.module.ts`](src/app.module.ts). Referências: `items/`, `packages/`,
`leads/`, `finance/`, `public/`, `page-settings/`, `dashboard/`. Infra transversal em `common/`,
`auth/`, `database/`, `uploads/` (este último é `@Global` e exporta o `UploadsService`).

**Exceção: `me/`** é o único módulo **sem `@ActiveOrg()`** — usa `@CurrentUser()`, porque por
definição atende quem ainda não tem organização (funcionário recém-convidado) e o `@ActiveOrg()`
lança `ForbiddenException` nesse caso. `GET /me/workspace` devolve buffets do usuário + convites
pendentes e é a **fonte que o front usa para decidir o destino pós-login**;
`POST /me/active-organization` troca a org da sessão (via `auth.api.setActiveOrganization`) e grava
`user.lastOrganizationId`, que o hook de criação de sessão restaura no próximo login.

**Reuso entre módulos:** quando um módulo precisa da regra de outro, exporte o service e importe o
módulo — nada de duplicar a query. Precedentes: `PublicModule` exporta o `PublicService`
(`buildPageData`, reusado pela prévia) e `FinanceModule` exporta o `FinanceService`
(`totals()`, reusado pelo `DashboardModule`).

## Controllers

Padrão (veja [`src/items/items.controller.ts`](src/items/items.controller.ts)):

- `@Controller("items")` — prefixo = recurso no **plural**.
- Injeta o service: `constructor(private readonly items: ItemsService) {}`.
- **Primeiro parâmetro de toda rota tenant-scoped é `@ActiveOrg() orgId: string`.** Nunca aceite
  `organizationId` vindo de body ou query.
- **Validação = Zod pipe**, nunca class-validator/DTO classes:
  `@Body(new ZodValidationPipe(createItemSchema)) body: CreateItemInput`, onde `CreateItemInput`
  é `z.infer<...>` importado de `@buffet/shared`.
- Query params chegam como `string` crua e são estreitados contra os enums de `@buffet/shared`
  (ex.: `ITEM_TYPES.includes(type as ItemType)`, `includeInactive === "true"`).
- Delete físico = `@Roles("owner")` + `@Delete(":id")` + `@HttpCode(204)`, handler retorna `void`.
- **Rota estática que colide com `:id` vem antes dela** no arquivo — ex.: `@Patch("order")` de
  `packages.controller.ts` (reordenação da vitrine) precede `@Patch(":id")`, senão "order" cai no update.

## Services

Padrão (veja `src/items/items.service.ts`, `src/packages/packages.service.ts`,
`src/finance/finance.service.ts`):

- `@Injectable()` + `constructor(@Inject(DB) private readonly db: Database) {}`.
- **Toda query passa por `scopedWhere`** (isolamento multi-tenant — ver abaixo).
- Helper privado `getOwnedOrThrow(orgId, id)` em cada service: busca a linha já escopada na org e
  lança `NotFoundException` se não existir. `update`/`remove`/detalhe chamam ele primeiro.
- Leitura de linha única: `const [row] = await ...; return row!;` (o `!` é ok porque
  `noUncheckedIndexedAccess` é `false` na api — ver Config TS).
- Update parcial: espalhe condicionalmente — `...(input.name !== undefined ? { name: input.name } : {})`.
- Escritas multi-tabela em `this.db.transaction(async (tx) => { ... })` (ex.: `packages.service.ts`
  recriando `package_items`).
- **Delete bloqueado quando referenciado:** lance `ConflictException` com mensagem tipo
  `"Inative-o em vez de excluir"` (item usado em pacote, pacote usado em lead).

## Auth & RBAC (RNF04)

Better-Auth é montado **fora do Nest**, direto no Express, em [`src/main.ts`](src/main.ts):

```ts
// bodyParser: false → Better-Auth lê o request cru; json() vem DEPOIS
expressApp.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json());
```

A ordem importa: handler de auth **antes** do `express.json()`.

Dois guards **globais** (`APP_GUARD`) em [`src/auth/auth.module.ts`](src/auth/auth.module.ts),
nesta ordem:

1. **`AuthGuard`** ([`auth.guard.ts`](src/auth/auth.guard.ts)) — resolve a sessão via
   `auth.api.getSession`, e anexa `req.auth: AuthContext` (`{ user, session, member }`, onde
   `member.role` vem de uma query em `schema.member`). Toda rota é autenticada **por padrão**.
2. **`RolesGuard`** ([`roles.guard.ts`](src/auth/roles.guard.ts)) — checa `@Roles(...)` contra
   `req.auth.member.role`; sem metadata, passa.

Opt-outs e decorators ([`auth/auth.constants.ts`](src/auth/auth.constants.ts),
[`auth/current-user.decorator.ts`](src/auth/current-user.decorator.ts)):

- `@Public()` — pula o `AuthGuard` (ex.: health check, endpoints públicos).
- `@Roles("owner")` — em **método ou classe** (o `FinanceController` inteiro é `@Roles("owner")`).
  Roles são `"owner" | "member"` (de `@buffet/shared`).
- `@ActiveOrg()` — retorna **`member.organizationId`**, não o campo da sessão; lança
  `ForbiddenException` se não houver associação viva. É o ponto de entrada padrão de toda rota
  tenant-scoped.
  ⚠️ **Nunca volte a ler `session.activeOrganizationId` aqui.** O Better-Auth só limpa esse campo
  quando o usuário se remove *a si mesmo* (`crud-members.mjs`): quando o proprietário demite um
  funcionário, a sessão dele continua apontando para a org. Como o `RolesGuard` passa direto em rota
  sem `@Roles` (a maioria), confiar na sessão manteria o acesso do ex-funcionário até ela expirar —
  e a sessão *desliza* a cada uso, então seria indefinido. O `AuthGuard` já relê a linha `member` em
  toda requisição, então checar aqui não custa query.
- `@CurrentRole()` — o papel na org ativa, com a mesma garantia. Use no lugar de
  `auth.member!.role`, que virava 500 em vez de 403 quando a associação sumia.
- `@CurrentUser()` — retorna o `AuthContext` completo.

## Máquina de estados da negociação (RF-V2-01 a RF-V2-04)

`leads_budgets.status` **só é escrito por `LeadsService.transition`**. O `PATCH /leads/:id` não
aceita mais `status`/`lostReason` — o `updateLeadSchema` nem tem os campos, para não sobrar caminho.

- **A tabela de transições é dado, em `@buffet/shared`** ([`transitions.ts`](../../packages/shared/src/transitions.ts)):
  `LEAD_TRANSITIONS` diz, por estado de origem, quais destinos existem, quem pode, se exige motivo e
  quais guards rodam. O front lê a **mesma** tabela para montar botões e liberar colunas do quadro —
  a regra nunca é reimplementada no cliente. Estados terminais simplesmente não listam saídas.
- **A decisão é uma função pura exportada**, `assertTransitionAllowed(from, to, role, reason)`, que
  devolve a regra ou lança. É o que torna a máquina testável sem banco (mesmo caminho do `dayRange`).
- **RNF04 é por transição, não por rota.** Cancelar é `owner`, avançar é de qualquer um, expirar é só
  do cron. Um `@Roles` no controller não expressa isso — o direito depende do destino. O cron é
  modelado como **mais um ator** (`TransitionRole = MemberRole | "system"`, regra `roles: ["system"]`),
  e não como um flag ao lado da lista de papéis: assim a autorização é um `includes` só, e não existe
  como escrever "só do sistema mas também do owner". Como `"system"` não é `MemberRole`, o
  `availableTransitions` que alimenta a UI já exclui essas regras sem filtro extra.
- **Compare-and-swap no `UPDATE`** (`... AND status = <origem>`): se ninguém foi afetado, outro
  usuário mudou o estado no meio e a resposta é `409`. Resolve a corrida de dois arrastes no quadro
  sem coluna de versão.
- **Tudo em `db.transaction`** (RNF-V2-01): status e log de auditoria caem juntos ou nenhum dos dois.
- **Guards de pré-condição** ficam num registro `Partial<Record<TransitionGuardKey, ...>>` no service.
  A chave é declarada na tabela de transições antes do guard existir — ligar um guard novo é uma
  linha no registro, não uma caçada pelo service.
- **`budget_status_log` é append-only e o banco garante** (RNF-V2-05): sem rota de escrita, sem
  `updatedAt`, e uma trigger que recusa UPDATE/DELETE. O log guarda o vocabulário da época (há
  `'formalizando'` lá) e por isso **não** leva CHECK — tipar `fromStatus` como o enum atual seria
  mentira.
- **"Não perdido" virou `NEGATIVE_LEAD_STATUSES`.** Com oito estados, `status <> 'perdido'` deixava
  cancelado e expirado ocupando a agenda e disparando alerta de conflito. Use o helper, não o literal.

## Jobs agendados (RF-V2-08)

`ScheduleModule.forRoot()` em [`app.module.ts`](src/app.module.ts); o único job hoje é
[`leads/expiration.service.ts`](src/leads/expiration.service.ts). Três regras ao adicionar outro:

- **Advisory lock, sempre.** Atrás de um LB há mais de uma instância e todas acordam na mesma hora.
  `pg_try_advisory_lock` com chave fixa faz uma só trabalhar; as outras saem sem log (acontece toda
  hora, por definição). O `pg_advisory_unlock` vai no **`finally`** — lock preso mata todos os
  ciclos seguintes.
- **O job usa o mesmo caminho de código do usuário.** A expiração chama `LeadsService.transition`
  com ator `SYSTEM_ACTOR` e papel `"system"`, e não um `UPDATE` direto: é o que garante transação,
  guards e log de auditoria. Mais curto seria deixar o histórico mentindo.
- **`try/catch` por registro, não por ciclo**, e teto de lote (100). Uma linha inconsistente não
  pode segurar as outras 99; o que sobrar entra no ciclo seguinte.

**Idempotência (RNF-V2-03) não precisa de código próprio:** o compare-and-swap do `transition`
(`WHERE status = <origem>`) faz a segunda passada não encontrar a linha. O mesmo mecanismo cobre a
corrida real — usuário aprova a proposta entre o `SELECT` e o `UPDATE`, o cron leva 409 e a decisão
do usuário ganha.

`run()` é público de propósito: dá para disparar um ciclo à mão de um `ApplicationContext`.

## Multi-tenancy (RNF05)

**Regra dura: toda query operacional injeta `organizationId`.** Use os helpers de
[`src/common/tenant.ts`](src/common/tenant.ts):

```ts
scopedWhere(table, orgId, ...conditions)  // = and(eq(table.organizationId, orgId), ...conditions)
```

Tabelas com `organizationId` direto: `items`, `packages`, `leads_budgets` (+ `member`).

Tabelas **sem** `organizationId` (`financial_payments`, `package_items`) isolam **via join com a
tabela pai**. Ex. em [`src/finance/finance.service.ts`](src/finance/finance.service.ts):

```ts
// financial_payments não tem organizationId → filtra pelo lead pai
.innerJoin(leadsBudgets, eq(financialPayments.budgetId, leadsBudgets.id))
.where(and(eq(financialPayments.id, id), eq(leadsBudgets.organizationId, orgId)))
```

Antes de tocar pagamentos por `budgetId`, chame `getLeadOwnedOrThrow(orgId, budgetId)`. Ao referenciar
ids externos (ex.: itens de um pacote), valide que pertencem à org (`assertItemsBelongToOrg` via
`inArray` + contagem). Há um teste que renderiza o SQL para garantir a cláusula:
[`src/common/tenant.test.ts`](src/common/tenant.test.ts).

## Endpoint público (RF18 / RNF06)

[`src/public/public.controller.ts`](src/public/public.controller.ts) — **único** grupo de rotas não
autenticadas:

- Classe com `@Public()` + `@UseGuards(ThrottlerGuard)`.
- `POST /public/leads` com `@Throttle({ default: { limit: 5, ttl: 60_000 } })` — 5/min por IP,
  mais apertado que o global de 100/min (`ThrottlerModule.forRoot` em `app.module.ts`).
- **Honeypot:** o schema tem `website: z.string().max(0).optional()`; o service rejeita se preenchido.
- **Preço autoritativo no servidor:** o service resolve a org pelo slug, valida que o pacote
  pertence à org e está ativo, e calcula `totalValue = computeBudgetTotal(pricePerPerson, guestCount)`
  — **nunca** confie num total enviado pelo cliente. Retorna só `{ id }`.

O payload da página (`buildPageData`) é montado uma vez só e reusado pela prévia do editor:
`PublicModule` exporta o `PublicService` e `GET /page-settings/preview` (`@Roles("owner")`,
declarada **antes** de qualquer rota com parâmetro) devolve a mesma resposta resolvida pela org da
sessão, com preço mesmo quando `showPrices` está desligado — quem esconde é o cliente, aplicando o
`applyPricePolicy` de `@buffet/shared` sobre o rascunho.

## Upload de imagens (RNF07)

[`src/uploads/`](src/uploads) é `@Global` e exporta o `UploadsService` para quem precisar gravar URL
de imagem. Ver a seção "Storage de imagens" do [`CLAUDE.md` da raiz](../../CLAUDE.md) para as regras.
Na prática, ao adicionar um campo de imagem em qualquer módulo:

```ts
// 1. injete o service (o módulo é @Global, não precisa importar nada)
constructor(@Inject(DB) private readonly db: Database,
            private readonly uploads: UploadsService) {}

// 2. valide ANTES de gravar — a URL tem que estar no bucket e no prefixo da org
if (input.logoUrl) this.uploads.assertOwnedAssetUrl(orgId, input.logoUrl);
```

Ao **apagar** a linha que referencia a imagem, chame `uploads.remove(orgId, url)` para não deixar o
objeto órfão (é o que `PackagesService.removeImage` faz). Na ordem inversa — quando a escrita é
adiada, como no editor da página — só apague **depois** do save, senão a página fica com foto
quebrada apontando para um objeto que já morreu.

## E-mail transacional (RNF09)

[`src/mail/`](src/mail) é `@Global` e exporta o `MailerService`. Duas regras ao mexer nisso:

- **`send()` nunca lança.** Captura o erro, loga e devolve `{ ok: false }`. E-mail é efeito
  colateral — não pode derrubar cadastro, convite nem a captação de um lead (RF18).
- **Nada de `await` no caminho de uma requisição do visitante.** O aviso de novo lead (RF32) sai
  com `void this.notifyNewLead(...).catch(...)` **depois** do insert: quem está do outro lado do
  `POST /public/leads` é um cliente esperando o orçamento, não pode pagar a latência do provedor.

- **Todo valor dinâmico no HTML passa por `esc()`** ([`mail.templates.ts`](src/mail/mail.templates.ts)).
  Os templates montam HTML por concatenação, e dois valores atravessam fronteira de confiança: o
  `customerName` do formulário público (anônimo) e o nome da org/convidante (cadastro self-service,
  sem limite de tamanho). Sem escape, o atacante autora marcação num e-mail que sai do **seu**
  domínio verificado — não é XSS (cliente de e-mail remove script), é phishing com remetente
  confiável. `subject` e `text` são texto puro e não precisam de escape.

O driver é escolhido no construtor: com `RESEND_API_KEY` faz `POST` para a API do Resend (via
`fetch` global — **não** adicione o SDK); sem ela, imprime o e-mail no terminal, com os links. É o
que mantém reset de senha e convite funcionando em dev sem provedor.

Os hooks do Better-Auth (`sendResetPassword`, `sendInvitationEmail`) moram em `@buffet/auth`, que
recebe um **port** `AuthMailPort` por injeção — o pacote de auth continua agnóstico de provedor, do
mesmo jeito que já recebe o `db`. O adaptador está em [`src/auth/auth.module.ts`](src/auth/auth.module.ts).

⚠️ **Pegadinha do reset (RF33):** o `url` entregue ao `sendResetPassword` aponta para a **API**
(`${baseURL}/api/auth/reset-password/:token?callbackURL=...`), que só redireciona para o
`callbackURL`. O cliente **tem** que mandar `redirectTo` no `requestPasswordReset`, senão o
parâmetro vem vazio e o link do e-mail morre numa tela em branco. O origin precisa estar em
`TRUSTED_ORIGINS` — a rota faz `originCheck`.

## Camada de dados (`@buffet/db`)

- `schema.ts` — `pgTable` + `relations` + tipos inferidos (`type Item = typeof items.$inferSelect`,
  `NewItem = $inferInsert`).
- `client.ts` — `createDb(connectionString)` → `drizzle(new Pool(...), { schema })`;
  `type Database = ReturnType<typeof createDb>`.
- Injeção via token `DB = Symbol("DB")` em [`src/database/database.module.ts`](src/database/database.module.ts)
  (`@Global`, pool único, lê `DATABASE_URL`). O factory do Better-Auth reusa o mesmo `DB`.

## Erros & respostas

- **Agregação é no Postgres, não em Node.** `count(*)::int`, `sum(...) filter (where ...)`, `group by`
  e window functions — nunca puxe as linhas para somar em JS. Duas pegadinhas ao agregar:
  - **Dinheiro:** `sum()` sobre zero linhas devolve `NULL` e a escala não é garantida. Use
    `coalesce(sum(...), 0)::numeric(12,2)` tipado como `sql<string>`, senão o valor não casa com o
    `moneySchema` nem com o `formatBRL` (dinheiro é string decimal).
  - **`GROUP BY` não emite linha zero:** preencha as chaves ausentes em JS iterando o enum de
    `@buffet/shared` (é o que o `DashboardService` faz com `LEAD_STATUSES`).
  Referência: [`src/dashboard/dashboard.service.ts`](src/dashboard/dashboard.service.ts) e
  `FinanceService.totals()`.
- **Recorte por papel (RNF04) mora no service, não no controller.** Quando um bloco da resposta é
  restrito, ele **não é consultado** para quem não tem direito — em vez de calcular e descartar. Ver
  `DashboardService.summary(orgId, role)`, que devolve `finance: null` para `member`.
- **Sem** exception filter ou interceptor de wrapping custom — usa a serialização padrão do Nest.
- Exceções nativas do Nest com **mensagens pt-BR**: `NotFoundException`, `BadRequestException`,
  `ConflictException`, `ForbiddenException`, `UnauthorizedException`.
- **Sem paginação, por decisão.** O kanban do funil precisa de todos os status de uma vez, e paginar
  quebraria a visão. `GET /leads` tem **teto de 500 linhas** (`desc(createdAt)`) + busca por termo no
  servidor (`?q=` com `ilike` em nome/telefone/e-mail); as demais listas retornam o conjunto todo,
  ordenado. Se um recurso passar a exigir rolagem infinita, a conversa é sobre busca, não paginação.
- Único shape estruturado é o do `ZodValidationPipe`: `{ message: "Dados inválidos", errors }`.

## Config TS específica & bootstrap

- [`tsconfig.json`](tsconfig.json) estende a base e **sobrepõe:** `experimentalDecorators: true`,
  `emitDecoratorMetadata: true` (DI do Nest), `noUncheckedIndexedAccess: false` (daí o padrão `row!`),
  `declaration: false`.
- `main.ts` começa com `import "reflect-metadata";` e usa `NestExpressApplication` com
  `bodyParser: false`. CORS lê `TRUSTED_ORIGINS` com `credentials: true` (cookies cross-origin).
- `ConfigModule.forRoot({ isGlobal: true })`, mas env é lida direto via `process.env.*` (sem config
  service tipado).

## Testes

Vitest (`*.test.ts` colocados, sem `vitest.config`). Só unit/guards — sem e2e/supertest. Ao criar um
módulo, espelhe os existentes: `auth/roles.guard.test.ts` (RBAC), `common/tenant.test.ts` (RNF05,
renderiza SQL), `leads/leads.service.test.ts`.

## Checklist para um novo módulo

1. Pasta + `*.module/controller/service.ts`; registrar em `app.module.ts`.
2. Schema Zod + tipos em `@buffet/shared`; tabela em `@buffet/db` (`generateId` como `$defaultFn`) →
   `pnpm build` → `db:generate` → `db:migrate`.
3. Controller: `@ActiveOrg()` primeiro, `ZodValidationPipe`, `@Roles("owner")` nos deletes.
4. Service: `scopedWhere` em toda query + `getOwnedOrThrow`.
5. Teste do que tem lógica; rodar `pnpm lint typecheck test`.
