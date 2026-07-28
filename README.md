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

# 3. Infra local
docker compose up -d               # Postgres em :5432 + MinIO em :9000 (console :9001)
                                   # o bucket buffet-assets é criado automaticamente
pnpm build                         # compila os packages (db/shared/auth)
pnpm db:generate                   # gera a migration a partir do schema
pnpm db:migrate                    # aplica no banco

# 4. Rodar
pnpm dev                           # web:3000 + api:3333

# 5. (Opcional) Dados de demonstração
pnpm build                         # garante apps/api/dist/seed.js
pnpm db:seed                       # cria org demo + catálogo + leads + parcelas
```

O seed é **idempotente** (recriar limpa a versão anterior) e imprime as credenciais:

- **Login:** `demo@buffetsystem.com` / `demo12345`
- **Página pública:** http://localhost:3000/buffet-demonstracao

## Walkthrough do MVP

1. **Signup + Onboarding** (`/signup` → `/onboarding`): o proprietário cria a conta e, no fluxo guiado, cria a organização (vira `owner`) e cadastra o catálogo inicial — pratos, bebidas, serviços e pacotes (RF00).
2. **Catálogo** (`/dashboard/catalog`): revisa e amplia pratos, bebidas, serviços e pacotes com preço por convidado (RF01–RF16), incluindo até 10 fotos por pacote (RF28).
3. **Página pública** (`/dashboard/pagina`, só owner): escolhe o layout entre Vitrine, Elegante e Direto (RF26), sobe logo e capa, escolhe a cor da marca e o tema, escreve os próprios textos, ordena e destaca os pacotes da vitrine e cadastra os canais de contato (RF25–RF27).
4. **Captação pública** (`/{slug}`): a partir do link público exibido no dashboard, o cliente preenche o formulário, vê a estimativa `preço × convidados` e gera um lead (RF17/RF18).
5. **Funil** (`/dashboard/leads`): move o lead entre status, registra o histórico, vê o alerta de conflito de data e copia a proposta para o WhatsApp (RF19–RF22).
6. **Financeiro** (`/dashboard/finance`, só owner): ao aprovar, gera o cronograma de parcelas e dá baixa com método + comprovante (RF23/RF24).

## Scripts

| Comando | Descrição |
|---|---|
| `pnpm dev` | Sobe web + api em watch |
| `pnpm build` | Build de todos os pacotes/apps (ordenado pelo Turbo) |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Verificações |
| `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:studio` | Drizzle Kit |
| `pnpm db:seed` | Popula dados de demonstração (carrega `.env` via dotenv-cli) |

## Cobertura de requisitos

| Módulo | Requisitos | Status |
|---|---|---|
| Cadastro da organização | RF00 | ✅ |
| Catálogo (itens/bebidas/serviços) | RF01–RF12 | ✅ |
| Pacotes de serviço | RF13–RF16 | ✅ |
| Captação pública de leads | RF17, RF18 | ✅ |
| Funil de negociações | RF19–RF22, RF35 (histórico datado com autoria) | ✅ |
| Financeiro (parcelas + baixa) | RF23, RF24 | ✅ |
| Página pública personalizável | RF25–RF28, RNF07 (upload isolado) | ✅ |
| Painel operacional | RF29 (funil, eventos, vencimentos), RF30 (checklist de configuração) | ✅ |
| Agenda de eventos | RF31 (calendário mensal + conflito de data, integrado ao RF21) | ✅ |
| Comunicação e acesso | RF32 (aviso de novo lead), RF33 (recuperação de senha), RF34 (convite por e-mail), RNF09 (e-mail plugável) | ✅ |
| Feedback e acessibilidade da UI | RNF08 (estados de carga/sucesso/erro, erro por campo, diálogo acessível) | ✅ |
| Não funcionais | RNF01 (auth), RNF02 (mobile), RNF04 (RBAC), RNF05 (isolamento), RNF06 (anti-spam) | ✅ |

> **RNF03 — Backup:** em produção o banco roda no **Neon**, que oferece backups
> automáticos contínuos e *point-in-time restore* (retenção conforme o plano) —
> nenhuma rotina manual é necessária. No ambiente local (Docker) não há backup;
> use `pnpm db:seed` para recriar dados de exemplo.

> **E-mail (RNF09):** sem `RESEND_API_KEY` no `.env`, o sistema usa o **driver
> console** — o e-mail é impresso no terminal da API com os links clicáveis, e
> recuperação de senha e convite funcionam ponta a ponta sem provedor externo.
> É o modo recomendado para desenvolvimento e demonstração. Para enviar de
> verdade, gere uma chave no [Resend](https://resend.com); note que o remetente
> padrão `onboarding@resend.dev` só entrega para o e-mail dono da conta Resend —
> em produção, verifique seu próprio domínio e ajuste `MAIL_FROM`.

> **Fora de escopo do MVP:** web push e central de notificações no painel;
> comprovantes financeiros continuam sendo link (o storage de imagens cobre só a
> página pública); template de proposta por organização; deploy.

## Roadmap (sprints)

0. **Fundação** — monorepo, schema, auth/db packages, CI ✅
1. **Auth + Organização + RBAC** + isolamento multi-tenant + convites ✅
2. **Catálogo** (itens/bebidas/serviços/pacotes) ✅
3. **Captação pública de leads** (onboarding por slug) ✅
4. **Funil de vendas** (negociações, conflito de agenda, proposta) ✅
5. **Financeiro** (parcelas + baixa, owner-only, isolamento via join) ✅
6. **Hardening** (seed de demonstração, docs, security review) ✅
7. **Página pública personalizável — dados e storage** (MinIO, upload pré-assinado, editor, galeria por pacote) ✅
8. **Página pública personalizável — os 3 templates** (Vitrine, Elegante, Direto) ✅
9. **Página pública personalizável — prévia ao vivo e fechamento** (editor em duas
   colunas, prévia celular/computador em iframe) ✅
10. **Camada de feedback e acessibilidade** (toast, esqueletos, estado vazio com ação,
    diálogo de confirmação acessível, erro de validação por campo) ✅
11. **Painel operacional** (agregação em SQL escopada por org, home com funil/eventos/
    vencimentos, checklist de configuração, badge de leads novos) ✅
12. **E-mail transacional** (mailer plugável com driver console, aviso de novo lead,
    recuperação de senha, convite de membro por e-mail) ✅
13. **Agenda de eventos** (calendário mensal em UTC, lista do dia, conflito de data
    ligado ao alerta da negociação; primeiros testes do `apps/web`) ✅
14. **Histórico de interações datado** (tabela `lead_notes` append-only com autor e
    carimbo de tempo, backfill do texto anterior; busca de leads no servidor) ✅
15. **Correções de `/code-review` + `/security-review`** (revogação de acesso, escape de
    HTML nos e-mails, invariante do cronograma, `trust proxy`, teto do orçamento) ✅

### Achados corrigidos na revisão (Sprint 15)

| Achado | Severidade | Correção |
|---|---|---|
| Sessão de membro removido mantinha acesso ao tenant — o Better-Auth só limpa `activeOrganizationId` quando o usuário se remove a si mesmo | **Alta** | `@ActiveOrg()` passa a derivar a org da linha `member`, não da sessão. Fecha toda rota de uma vez |
| HTML não escapado nos e-mails: `customerName` (formulário público, anônimo) e nome da org/convidante viravam marcação enviada pelo domínio verificado | Média | `esc()` em todo valor dinâmico do HTML |
| `auth.member!.role` estourava 500 em vez de 403 | Média | Novo decorator `@CurrentRole()` |
| Alterar pacote/convidados com cronograma gerado quebrava a soma das parcelas, sem como regerar | Média | `409` pedindo excluir as parcelas antes |
| Sem `trust proxy`, o limite de 5/min do formulário público virava um balde global atrás de LB | Média | `TRUST_PROXY` opt-in (desligado em dev, para não permitir forjar `X-Forwarded-For`) |
| `pricePerPerson × guestCount` podia estourar `numeric(12,2)` → 500 e lead perdido | Baixa | `fitsBudgetTotal()` recusa com 400 legível |
