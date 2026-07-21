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

# 5. (Opcional) Dados de demonstração
set -a; . .env; set +a             # exporta DATABASE_URL etc. no shell
pnpm db:seed                       # cria org demo + catálogo + leads + parcelas
```

O seed é **idempotente** (recriar limpa a versão anterior) e imprime as credenciais:

- **Login:** `demo@buffetsystem.com` / `demo12345`
- **Página pública:** http://localhost:3000/buffet-demonstracao

## Walkthrough do MVP

1. **Signup** (`/signup`): o proprietário se cadastra e cria a organização — vira `owner` (RF00).
2. **Catálogo** (`/dashboard/catalog`): cadastra pratos, bebidas, serviços e pacotes com preço por convidado (RF01–RF16).
3. **Captação pública** (`/{slug}`): o cliente preenche o formulário, vê a estimativa `preço × convidados` e gera um lead (RF17/RF18).
4. **Funil** (`/dashboard/leads`): move o lead entre status, registra o histórico, vê o alerta de conflito de data e copia a proposta para o WhatsApp (RF19–RF22).
5. **Financeiro** (`/dashboard/finance`, só owner): ao aprovar, gera o cronograma de parcelas e dá baixa com método + comprovante (RF23/RF24).

## Scripts

| Comando | Descrição |
|---|---|
| `pnpm dev` | Sobe web + api em watch |
| `pnpm build` | Build de todos os pacotes/apps (ordenado pelo Turbo) |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Verificações |
| `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:studio` | Drizzle Kit |
| `pnpm db:seed` | Popula dados de demonstração (requer `.env` no shell) |

## Cobertura de requisitos

| Módulo | Requisitos | Status |
|---|---|---|
| Cadastro da organização | RF00 | ✅ |
| Catálogo (itens/bebidas/serviços) | RF01–RF12 | ✅ |
| Pacotes de serviço | RF13–RF16 | ✅ |
| Captação pública de leads | RF17, RF18 | ✅ |
| Funil de negociações | RF19–RF22 | ✅ |
| Financeiro (parcelas + baixa) | RF23, RF24 | ✅ |
| Não funcionais | RNF01 (auth), RNF02 (mobile), RNF04 (RBAC), RNF05 (isolamento), RNF06 (anti-spam) | ✅ |

> **RNF03 — Backup:** em produção o banco roda no **Neon**, que oferece backups
> automáticos contínuos e *point-in-time restore* (retenção conforme o plano) —
> nenhuma rotina manual é necessária. No ambiente local (Docker) não há backup;
> use `pnpm db:seed` para recriar dados de exemplo.

> **Fora de escopo do MVP:** notificação automática de novo lead; storage de
> arquivos (comprovantes são link); template de proposta por organização; deploy.

## Roadmap (sprints)

0. **Fundação** — monorepo, schema, auth/db packages, CI ✅
1. **Auth + Organização + RBAC** + isolamento multi-tenant + convites ✅
2. **Catálogo** (itens/bebidas/serviços/pacotes) ✅
3. **Captação pública de leads** (onboarding por slug) ✅
4. **Funil de vendas** (negociações, conflito de agenda, proposta) ✅
5. **Financeiro** (parcelas + baixa, owner-only, isolamento via join) ✅
6. **Hardening** (seed de demonstração, docs, security review) ✅
