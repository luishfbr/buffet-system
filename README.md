# Buffet System

SaaS multi-tenant para gestão de demandas e negociações de buffets — do lead
público ao controle financeiro. Monorepo Turborepo + pnpm.

## Stack

- **Web:** Next.js 15 (App Router) · Tailwind CSS v4 · shadcn/ui
- **API:** Nest.js 11 (REST, guards globais, Better-Auth handler)
- **DB:** PostgreSQL (Neon em prod / Docker local) · Drizzle ORM · IDs UUIDv7
- **Auth/RBAC:** Better-Auth (plugins Organization + Admin)

## Estrutura

```
apps/
  web/    Next.js — painel administrativo + páginas públicas de onboarding
  api/    Nest.js — REST API + handler Better-Auth (fonte única de sessão/roles)
packages/
  db/     Schema Drizzle + client + migrations + gerador UUIDv7
  auth/   Configuração Better-Auth (server) + client React
  shared/ Enums de domínio, DTOs Zod, helpers de dinheiro
  config/ tsconfig / eslint compartilhados
```

## Setup local

```bash
# 1. Dependências
pnpm install

# 2. Variáveis de ambiente
cp .env.example .env   # ajuste BETTER_AUTH_SECRET (openssl rand -base64 32)

# 3. Banco local
docker compose up -d               # Postgres em localhost:5432
pnpm build                         # compila os packages (db/shared/auth)
pnpm db:generate                   # gera a migration a partir do schema
pnpm db:migrate                    # aplica no banco

# 4. Rodar
pnpm dev                           # web:3000 + api:3333
```

## Scripts

| Comando | Descrição |
|---|---|
| `pnpm dev` | Sobe web + api em watch |
| `pnpm build` | Build de todos os pacotes/apps (ordenado pelo Turbo) |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Verificações |
| `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:studio` | Drizzle Kit |

## Roadmap (sprints)

0. **Fundação** — monorepo, schema, auth/db packages, CI ✅
1. **Auth + Organização + RBAC** + isolamento multi-tenant + convites ✅
2. **Catálogo** (itens/bebidas/serviços/pacotes) ✅
3. **Captação pública de leads** (onboarding por slug) ✅
4. Funil de vendas (negociações)
5. Financeiro (parcelas + baixa)
6. Hardening (testes, responsividade, security review)
