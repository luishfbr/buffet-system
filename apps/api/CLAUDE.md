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
`leads/`, `finance/`, `public/`, `page-settings/`. Infra transversal em `common/`, `auth/`,
`database/`, `uploads/` (este último é `@Global` e exporta o `UploadsService`).

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
- `@ActiveOrg()` — retorna `session.activeOrganizationId`; lança `ForbiddenException` se não houver
  org ativa. É o ponto de entrada padrão de toda rota tenant-scoped.
- `@CurrentUser()` — retorna o `AuthContext` completo.

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

## Camada de dados (`@buffet/db`)

- `schema.ts` — `pgTable` + `relations` + tipos inferidos (`type Item = typeof items.$inferSelect`,
  `NewItem = $inferInsert`).
- `client.ts` — `createDb(connectionString)` → `drizzle(new Pool(...), { schema })`;
  `type Database = ReturnType<typeof createDb>`.
- Injeção via token `DB = Symbol("DB")` em [`src/database/database.module.ts`](src/database/database.module.ts)
  (`@Global`, pool único, lê `DATABASE_URL`). O factory do Better-Auth reusa o mesmo `DB`.

## Erros & respostas

- **Sem** exception filter ou interceptor de wrapping custom — usa a serialização padrão do Nest.
- Exceções nativas do Nest com **mensagens pt-BR**: `NotFoundException`, `BadRequestException`,
  `ConflictException`, `ForbiddenException`, `UnauthorizedException`.
- **Sem paginação** — listas retornam o conjunto todo, ordenado (`desc(createdAt)` em geral,
  `asc(dueDate)` em parcelas).
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
