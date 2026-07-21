# Sistema de Gerenciamento de Demandas para Buffets (SaaS MVP)

## 🎯 Objetivo

Desenvolver um sistema de gerenciamento de demandas direcionado para buffets, centralizando pedidos e organizando o fluxo comercial da empresa responsável. O sistema soluciona o problema crônico de descentralização dos atendimentos comerciais (que iniciam em formulários ou canais fragmentados e migram para o WhatsApp) restaurando a total rastreabilidade, controle de faturamento e histórico de negociações.

## 💻 Stack Tecnológica & Arquitetura

- **Front-end:** Next.js (App Router, Tailwind CSS, Shadcn/ui)
- **Back-end:** Nest.js (REST API, Guards Globais)
- **Banco de Dados:** PostgreSQL hospedado no Neon
- **ORM:** Drizzle ORM (Uso nativo de IDs gerados em formato UUIDv7 na aplicação)
- **Autenticação & RBAC:** Better-Auth (Utilizando Plugins oficiais de _Organization_ e _Admin_)
- **Estrutura de Código:** Monorepo (Next.js, Nest.js e o pacote de banco de dados compartilhando os mesmos schemas TypeScript)

## 👥 Atores, Papéis e Restrições (Better-Auth RBAC)

- **Administrador (Plataforma):** Usuário global (role `admin` no Better-Auth) para gerenciar o ecossistema SaaS e auditar organizações.
- **Proprietário (Tenant Owner):** Usuário com role `owner` na tabela `member`. Possui acesso total aos dados de sua própria organização, incluindo faturamento corporativo, dashboards financeiros, configurações de pacotes, relatórios e exclusão de registros.
- **Funcionário (Tenant Member):** Usuário com role `member` na tabela `member`. Focado na operação comercial diária. Possui visibilidade e edição completas sobre todas as negociações da organização — não há atribuição individual de vendedor no MVP (qualquer member pode acessar e atualizar qualquer negociação).
  - _Restrições estritas de segurança:_ Não visualiza totalizadores de faturamento da empresa, não possui permissão para deletar pratos, bebidas, pacotes ou registros financeiros, e não acessa painéis de auditoria.
- **Cliente (Lead):** Usuário externo e não autenticado que acessa a interface de onboarding público para simulação e solicitação de pré-orçamentos.

## ⚠️ Problemas Identificados vs. Soluções do MVP

- **Descentralização e perda de dados:** Resolvido através do Onboarding Público de Leads e histórico centralizado.
- **Localização de orçamentos lenta:** Resolvido pela Lista Dinâmica com filtros por status de negociação.
- **Controle financeiro manual:** Resolvido pelo Cronograma Base de Parcelas no módulo financeiro.
- **Risco de overbooking:** Resolvido por alertas visuais de conflito de datas na agenda.

## 🚫 Fora de Escopo (MVP)

- **Notificação automática de novo lead:** O RF18 gera o registro no sistema, mas o MVP não envia notificação automática (e-mail, push ou painel) ao buffet quando um novo lead chega. Fica registrado como melhoria futura, não como lacuna do MVP.

---

## 🛠️ Requisitos Funcionais (RF)

### Módulo de Cadastro da Organização (Tenant Onboarding)

- **RF00 - Cadastro Self-Service da Organização:** O proprietário do buffet se cadastra de forma autônoma na plataforma e cria sua própria organização (nome + slug gerado automaticamente pelo plugin Organization do Better-Auth), assumindo o papel `owner` automaticamente. Não há criação manual de organizações por um administrador da plataforma no MVP.

### Módulo de Itens e Cardápio (CRUD Básico)

- **RF01 - Criar Pratos e Tipos:** Permite cadastrar pratos especificando nome, categoria (entrada, principal, sobremesa) e preço base.
- **RF02 - Editar Pratos e Tipos:** Permite alterar dados de pratos cadastrados.
- **RF03 - Inativar Pratos e Tipos:** Permite desativar itens sem excluí-los do histórico de orçamentos antigos.
- **RF04 - Excluir Pratos e Tipos:** Exclusão física permitida apenas para itens sem vínculos a orçamentos (_Apenas Proprietários_).
- **RF05 - Criar Bebidas:** Permite cadastrar bebidas (alcoólicas e não alcoólicas) e preços bases.
- **RF06 - Editar Bebidas:** Modificação de propriedades das bebidas.
- **RF07 - Inativar Bebidas:** Oculta bebidas de novas listagens mantendo integridade histórica.
- **RF08 - Excluir Bebidas:** Exclusão física sob validação de dependências (_Apenas Proprietários_).
- **RF09 - Criar Serviços:** Cadastra serviços adicionais (garçom, copeira, decoração, DJ).
- **RF10 - Editar Serviços:** Edição de valores padrão e descrições de serviços.
- **RF11 - Inativar Serviços:** Desativação lógica de serviços.
- **RF12 - Excluir Serviços:** Remoção física se não houver vínculos (_Apenas Proprietários_).

### Módulo de Pacotes de Serviço

- **RF13 - Criar Pacotes de Serviço:** Permite agrupar Pratos, Bebidas e Serviços estabelecendo um **Preço Fixo por Convidado** (Ex: Pacote Ouro - R$ 150,00/pessoa).
- **RF14 - Editar Pacotes de Serviço:** Atualiza composição e valor per capita do pacote.
- **RF15 - Inativar Pacotes de Serviço:** Impede novas vendas do pacote.
- **RF16 - Excluir Pacotes de Serviço:** Exclusão restrita à ausência de dependências de uso (_Apenas Proprietários_).

### Módulo de Captação e Onboarding Público (CRM Inbound)

- **RF17 - Disponibilizar URL Pública de Onboarding:** O sistema expõe páginas públicas baseadas no slug gerado pelo plugin do Better-Auth no formato `https://buffetsystem.com{slug}`.
- **RF18 - Capturar Pré-Orçamento via Formulário:** Página pública e responsiva onde o cliente preenche: nome, e-mail, WhatsApp (chave de rastreio), data pretendida do evento, número estimado de convidados e escolhe o pacote de interesse. O sistema calcula e exibe um valor estimado instantâneo para o cliente (`totalValue = pricePerPerson × guestCount`, sem seleção de itens avulsos nesta etapa pública) e gera um registro no sistema do buffet. Como o cliente acessa a página sem sessão autenticada, o `organizationId` do registro é resolvido a partir do slug presente na própria URL pública.

### Módulo de Gestão de Negociações (Funil de Vendas)

- **RF19 - Listagem Dinâmica de Negociações:** Tela gerencial para o buffet visualizar leads em uma tabela avançada com filtros rápidos por status: `Novo (Lead)`, `Em Negociação`, `Formalizando`, `Aprovado` e `Perdido`. A listagem é compartilhada entre todos os members da organização (sem filtro por vendedor responsável, conforme definido na seção de Atores).
- **RF20 - Histórico de Interações:** Espaço de texto livre dentro da negociação para registrar anotações, ligações e detalhes combinados pelo WhatsApp, mantendo a rastreabilidade do atendimento.
- **RF21 - Alerta Visual de Conflito de Agenda (Flexível):** Ao abrir ou editar uma negociação, o sistema verifica se já existem outros eventos salvos ou aprovados na mesma data e exibe um alerta gráfico em destaque na tela ("Atenção: Já existem X eventos nesta data"), sem bloquear o salvamento do registro.
- **RF22 - Copiar Proposta/Contrato Textual:** O sistema gera um template textual pré-definido com os dados dinâmicos do cliente, valores e pacote escolhido. Disponibiliza um botão de "Copiar Texto" para que o vendedor possa colar diretamente no WhatsApp ou Word. No MVP, o template é fixo (hardcoded) e igual para todas as organizações, apenas com variáveis dinâmicas interpoladas (nome do cliente, valor total, pacote, data do evento); a configuração de template por organização fica fora de escopo.

### Módulo Financeiro Simplificado

- **RF23 - Cronograma Prévio de Pagamentos:** Ao aprovar uma negociação, o sistema permite gerar parcelas financeiras vinculadas (Ex: Entrada + parcelas intermediárias), registrando a data de vencimento e o valor de cada uma.
- **RF24 - Baixa de Parcelas e Comprovantes:** Permite alterar o status da parcela para "Pago", definir o método de pagamento (PIX, Cartão, Boleto) e anexar o link/arquivo do comprovante.

---

## 🔒 Requisitos Não Funcionais (RNF)

- **RNF01 - Autenticação Delegada (Better-Auth):** A gestão de sessões, hashes de senhas, validações e cookies será totalmente gerenciada pelo Better-Auth.
- **RNF02 - Responsividade Móvel:** A interface administrativa deve ser responsiva para smartphones, e a página de Onboarding Público do Cliente (`RF18`) deve ser otimizada prioritariamente para ambiente mobile.
- **RNF03 - Backup Periódico via Neon:** A persistência dos dados contará com as rotinas automatizadas de backup em nuvem oferecidas pela infraestrutura da Neon.
- **RNF04 - Controle de Acesso Baseado em Funções (RBAC):** Restrição de endpoints no Nest.js através de guards que validam as roles do Better-Auth, bloqueando requisições financeiras e mutações de dados para quem for `member` (Funcionário).
- **RNF05 - Isolamento Lógico Multi-tenant:** Toda query operacional de negócio executada pelo Drizzle ORM no Nest.js deve injetar explicitamente o identificador da organização na cláusula `where(eq(table.organizationId, session.activeOrganizationId))`. Para tabelas sem `organizationId` direto (ex: `financial_payments`), o isolamento é garantido via join com a tabela pai (`leads_budgets`).
- **RNF06 - Proteção Básica Contra Spam no Formulário Público:** Por ser o único endpoint não autenticado do sistema, o formulário de captação (`RF18`) deve contar com uma camada mínima de proteção contra automação (honeypot field e/ou rate limit por IP).

---

## 📐 Modelagem de Domínio (Drizzle ORM + Better-Auth Schema)

```typescript
import {
  pgTable,
  text,
  timestamp,
  boolean,
  numeric,
  integer,
  primaryKey,
} from "drizzle-orm/pg-core";

// ==========================================
// 1. INFRAESTRUTURA & AUTENTICAÇÃO (Better-Auth Core)
// ==========================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  role: text("role"),
  banned: boolean("banned"),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  activeOrganizationId: text("activeOrganizationId"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt"),
  updatedAt: timestamp("updatedAt"),
});

// ==========================================
// 2. MULTI-TENANCY (Better-Auth Organization Plugin)
// ==========================================

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  createdAt: timestamp("createdAt").notNull(),
  metadata: text("metadata"),
});

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organizationId")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organizationId")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  inviterId: text("inviterId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

// ==========================================
// 3. REGRAS DE NEGÓCIO DO BUFFET
// ==========================================

export const items = pgTable("items", {
  id: text("id").primaryKey(),
  organizationId: text("organizationId")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  category: text("category"),
  basePrice: numeric("basePrice", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const packages = pgTable("packages", {
  id: text("id").primaryKey(),
  organizationId: text("organizationId")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  pricePerPerson: numeric("pricePerPerson", {
    precision: 10,
    scale: 2,
  }).notNull(),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const packageItems = pgTable(
  "package_items",
  {
    packageId: text("packageId")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    itemId: text("itemId")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [table.packageId, table.itemId],
    }),
  ]
);

export const leadsBudgets = pgTable("leads_budgets", {
  id: text("id").primaryKey(),
  organizationId: text("organizationId")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  customerName: text("customerName").notNull(),
  customerEmail: text("customerEmail"),
  customerPhone: text("customerPhone").notNull(),
  eventDate: timestamp("eventDate"),
  guestCount: integer("guestCount"),
  packageId: text("packageId").references(() => packages.id),
  totalValue: numeric("totalValue", { precision: 12, scale: 2 }),
  status: text("status").notNull(),
  lostReason: text("lostReason"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const financialPayments = pgTable("financial_payments", {
  id: text("id").primaryKey(),
  budgetId: text("budgetId")
    .notNull()
    .references(() => leadsBudgets.id, { onDelete: "cascade" }),
  dueDate: timestamp("dueDate").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull(),
  paymentMethod: text("paymentMethod"),
  paidAt: timestamp("paidAt"),
  receiptUrl: text("receiptUrl"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
```