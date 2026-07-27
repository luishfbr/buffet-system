# CLAUDE.md — Buffet System

Guia de convenções para o **Buffet System**: um SaaS multi-tenant de gestão de demandas e
negociações para buffets, cobrindo do lead público ao controle financeiro. Este arquivo é o
**contrato de padrões do repositório** — toda feature nova deve segui-lo para o app manter um
padrão único.

- **Requisitos (RF/RNF):** [`docs/requirements.md`](docs/requirements.md) — fonte de verdade do domínio.
- **Setup, walkthrough e cobertura de requisitos:** [`README.md`](README.md). Não repita o
  conteúdo do README aqui; para "como rodar" mande o leitor para lá.
- **Backend:** [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) · **Frontend:** [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md).

## Arquitetura do monorepo

Turborepo + pnpm workspaces (Node ≥22, `pnpm@11`). A **API é a fonte única de sessão/roles**;
o front e os guards apenas consomem dela.

| Pacote | Responsabilidade | Porta |
|---|---|---|
| `apps/web` | Next.js 15 — painel administrativo + páginas públicas de onboarding | 3000 |
| `apps/api` | Nest.js 11 — REST API + handler Better-Auth | 3333 |
| `packages/db` | Schema Drizzle + client `pg` + migrations + gerador UUIDv7 | — |
| `packages/auth` | Config Better-Auth (server `createAuth`) + client React (`./client`) | — |
| `packages/shared` | Enums de domínio, DTOs Zod, helpers de dinheiro/proposta | — |
| `packages/config` | `tsconfig.base.json` + `eslint.config.mjs` compartilhados | — |

Pacotes são linkados via `workspace:*` e enviam ESM compilado em `dist/`. A ordem de build é
topológica (Turbo `dependsOn: ["^build"]`).

## Convenções cross-cutting (valem para todo o repo)

Estas regras se aplicam a **web e api**; os arquivos filhos não as repetem.

- **ESM + NodeNext — extensão `.js` obrigatória.** Todo import relativo usa `.js` explícito,
  **inclusive em `.ts`**: `import { AppModule } from "./app.module.js"`. Cross-package imports
  resolvem para `dist`. (Exceção: `apps/web` usa `moduleResolution: Bundler` com alias `@/*`.)
- **UUIDv7 em tudo.** Único gerador `generateId()` em [`packages/db/src/id.ts`](packages/db/src/id.ts),
  usado como `$defaultFn` nas tabelas de negócio do Drizzle **e** em `advanced.database.generateId`
  do Better-Auth. Nunca gere ids de outra forma.
- **Dinheiro é sempre string decimal.** Colunas `numeric` do Drizzle chegam como `string`. Toda
  aritmética passa pelos helpers de `@buffet/shared` (`money.ts`): `toCents`/`fromCents`/`sumMoney`/
  `multiplyMoney`/`splitInstallments`/`computeBudgetTotal`/`formatBRL`. **Nunca use floats para dinheiro.**
- **Fonte de verdade compartilhada.** Enums e labels de domínio e schemas Zod vivem em
  `@buffet/shared` (`domain.ts`, `dtos.ts`); o schema de dados vive em `@buffet/db`. **Não
  hardcode** enums, labels ou DTOs dentro das apps — importe de `@buffet/shared`.
- **Idioma:** toda copy voltada ao usuário e mensagens de erro em **pt-BR**. Datas renderizadas com
  `timeZone: "UTC"` (ex.: `toLocaleDateString("pt-BR", { timeZone: "UTC" })`).
- **Rastreabilidade:** ao implementar algo ligado a um requisito, marque com a tag `RF##`/`RNF##`
  em comentário (convenção já usada em todo o código).

## Workflow de banco de dados

⚠️ **Pegadinha crítica:** [`packages/db/drizzle.config.ts`](packages/db/drizzle.config.ts) aponta
para `./dist/schema.js` (compilado), **não** para o `src`, por causa dos imports `.js` do NodeNext.
Logo, **recompile o pacote antes de gerar/aplicar migrations.**

Fluxo ao alterar o schema:

```bash
# 1. edite packages/db/src/schema.ts
pnpm --filter @buffet/db build   # recompila @buffet/db → dist/schema.js
pnpm db:generate                 # drizzle-kit gera a migration em packages/db/drizzle/
pnpm db:migrate                  # aplica no banco
```

⚠️ **Use o `--filter`, não o `pnpm build` da raiz, com o `pnpm dev` rodando.** O build da raiz passa
por `apps/web` e escreve o bundle de produção em `apps/web/.next` — o mesmo diretório que o `next dev`
está usando. O dev server passa a carregar chunks do outro build e quebra com
`Cannot find module './<n>.js'`. Se acontecer: pare o dev, `rm -rf apps/web/.next`, suba de novo.

| Script | Onde roda | O quê |
|---|---|---|
| `pnpm db:generate` / `db:migrate` / `db:studio` | pacote `@buffet/db` | Drizzle Kit |
| `pnpm db:seed` | pacote `@buffet/api` | Seed idempotente de demonstração (precisa do runtime Nest/Better-Auth; carrega `.env` via dotenv-cli) |

Migrations versionadas em `packages/db/drizzle/*.sql` + `meta/_journal.json`. Postgres local via
`docker compose up -d` (porta 5432); em produção roda no Neon.

## Storage de imagens (RNF07)

`docker compose up -d` também sobe **MinIO** (API 9000, console 9001) e um `minio-init` que cria o
bucket `buffet-assets` com leitura anônima. O upload é **direto do navegador para o bucket** via URL
pré-assinada emitida por `POST /uploads/presign` — o byte nunca passa pela API.

Duas regras inegociáveis ao mexer nisso:

- **A chave do objeto é derivada no servidor** (`orgs/<orgId>/<escopo>/<uuidv7>.<ext>`); nada de
  caminho vindo do cliente.
- **Toda URL de imagem persistida passa por `UploadsService.assertOwnedAssetUrl(orgId, url)`** antes
  de ir ao banco, senão o campo vira um "cole a URL que quiser".

A assinatura inclui `content-type` e `content-length` (`signableHeaders`) — sem o primeiro, o bucket
grava o tipo que o cliente mandar e um HTML acaba servido a partir do host de assets.

## Variáveis de ambiente

Um **único `.env` na raiz** alimenta tudo (documentado em `.env.example`, git-ignored). O
`apps/api` o alcança com `dotenv -e ../../.env`; o `apps/web` usa apenas vars `NEXT_PUBLIC_*`.
Nunca commite o `.env`.

| Var | Consumidor | Nota |
|---|---|---|
| `DATABASE_URL` | api / db | Postgres local (Docker) ou Neon |
| `BETTER_AUTH_SECRET` | api | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | api | `http://localhost:3333` |
| `TRUSTED_ORIGINS` | api | CSV de origins de CORS (default `http://localhost:3000`) |
| `NEXT_PUBLIC_API_URL` | web | base da API (`http://localhost:3333`) |
| `NEXT_PUBLIC_APP_URL` | web | base do app, para montar links `/{slug}` |
| `S3_*` | api | endpoint/bucket/credenciais do storage de imagens (MinIO local) |
| `PUBLIC_ASSET_BASE_URL` | api | base pública dos objetos; **toda URL de imagem salva é validada contra ela** |

## Qualidade & CI

- **Lint:** ESLint 9 flat, compartilhado de `@buffet/config/eslint` (cada app re-exporta em 1 linha).
- **Format:** Prettier na raiz (`.prettierrc.json`) — `pnpm format`.
- **Types:** `pnpm typecheck` (`tsc --noEmit` por pacote).
- **Testes:** Vitest, arquivos `*.test.ts` **colocados** ao lado do código. Sem e2e.
- **CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)): em push para `main` e em toda PR,
  roda `build → lint → typecheck → test` em Node 22.

**Antes de considerar uma feature pronta, rode `pnpm lint`, `pnpm typecheck` e `pnpm test`** (é o
que a CI vai verificar).

## Padronização de skills (fluxo recomendado)

Use as skills do Claude Code nos momentos abaixo para manter o padrão de engenharia:

- **Em features de frontend:** as skills de design são **padrão** — `frontend-design` ao criar/reformular
  UI e `web-design-guidelines` ao fechá-la. Detalhes em [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md).
- **Ao fechar uma feature/sprint:** `/code-review` (bugs no diff) e `/security-review`. Este projeto
  é multi-tenant com um endpoint público — dê ênfase a **RNF04 (RBAC)**, **RNF05 (isolamento por
  `organizationId`)** e ao formulário público (RF18/RNF06). A Sprint 6 já incorporou um security review.
- **Antes de commitar:** `/simplify` para revisar reuso e simplificação do diff (qualidade, não bugs).
- **Uma vez por ambiente:** `fewer-permission-prompts` para reduzir prompts de permissão em comandos
  read-only recorrentes (`pnpm`, `git`, `drizzle-kit`).

> `/code-review ultra` (alias depreciado `/ultrareview`) é uma revisão multi-agente **disparada pelo
> usuário** e faturada — o agente **não** deve executá-la sozinho.

## Convenções de commit / branch

- Mensagens no formato `Sprint N: <descrição> (RFxx–RFyy)`, em pt-BR.
- Branch de trabalho atual: `feat/buffet-mvp`; branch base para PRs: `main`.

## Onde continuar

- Padrões de **backend** (módulos Nest, guards, multi-tenancy, camada de dados): [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md).
- Padrões de **frontend** (App Router, fetch, auth no cliente, UI): [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md).
