# Documento de Requisitos — v2
**Sistema de Gerenciamento de Demandas para Buffets**
**Versão:** 2.0 · **Base:** MVP v1 completo · **Natureza:** Evolução incremental

---

> **Errata (aplicada na Sprint 18).** Três ajustes feitos ao confrontar o documento com o código:
>
> - **`RF-V2-08` aparecia duplicado** — como "Cron de expiração" (Bloco 3) e como "Schema
>   `budget_revisions`" na ordem de implementação. O schema de revisões é **RF-V2-11**; a tabela do
>   RF-V2-02 também citava RF-V2-08 onde queria dizer RF-V2-11. Corrigido abaixo.
> - **`packages/contracts` não existe** neste repo. O pacote de contratos é **`@buffet/shared`**, e é
>   onde o motor de precificação e a tabela de transições vivem.
> - **`proposalValidityDays` não vai na tabela `organization`**, que é do Better-Auth. O repo já
>   resolveu isso antes criando `org_public_settings`; a v2 usa uma `org_settings` pelo mesmo motivo.
>
> **Nomenclatura:** os estados foram implementados em **lowercase snake** (`proposta_enviada`), e não
> em MAIÚSCULA como escrito aqui, para acompanhar `PAYMENT_STATUSES`/`ITEM_TYPES`/`MEMBER_ROLES` — e
> porque quatro dos cinco valores do MVP já eram estados formais e não precisaram ser reescritos no
> banco. A semântica de cada estado é exatamente a da tabela do RF-V2-01.

## Visão Geral

A v2 não reescreve o produto — ela aprofunda o controle sobre o ciclo de vida de cada negociação. O MVP resolveu a captação e a organização básica do funil; a v2 resolve os três problemas que aparecem depois que o produto está em uso: preços históricos que mudam sem aviso, status de negociação que qualquer um altera sem rastro, e propostas que ficam abertas indefinidamente sem resposta do cliente.

As features foram selecionadas a partir do comparativo com o documento de projeto original e agrupadas por dependência: a máquina de estados é o alicerce que habilita ou melhora tudo que vem depois dela.

---

## Fora de Escopo (v2)

- ❌ Login do cliente / painel self-service do cliente
- ❌ Aprovação ou recusa da proposta pelo cliente via sistema
- ❌ Kanban visual com drag-and-drop
- ❌ Pagamento online, contrato digital ou WhatsApp Business API
- ❌ Dashboard analítico avançado

---

## 🛠️ Requisitos Funcionais

---

### Bloco 1 — Máquina de Estados da Negociação

> **Dependência de outros blocos:** os blocos 2, 3 e 5 dependem deste. Implementar primeiro.

#### RF-V2-01 — Estados formais de negociação

O campo `status` da tabela `leads_budgets` passa a aceitar apenas os seguintes valores, substituindo o texto livre atual:

| Estado | Significado operacional |
|---|---|
| `NOVO` | Lead recém-chegado, aguardando atendimento |
| `EM_NEGOCIACAO` | Atendimento iniciado, proposta sendo elaborada |
| `PROPOSTA_ENVIADA` | Proposta formal enviada ao cliente; aguardando retorno |
| `APROVADO` | Cliente aceitou; aguardando fechamento interno |
| `FECHADO` | Negociação encerrada com sucesso |
| `PERDIDO` | Negociação encerrada sem conversão |
| `CANCELADO` | Encerrado internamente (duplicata, teste, erro de cadastro) |
| `EXPIRADO` | Proposta não respondida após o prazo de validade |

Os valores atuais do MVP (`Novo (Lead)`, `Em Negociação`, `Formalizando`, `Aprovado`, `Perdido`) são migrados para os estados formais correspondentes na migration de banco.

#### RF-V2-02 — Transições válidas com guards

Nenhum status pode ser alterado livremente. Apenas as transições abaixo são permitidas pelo sistema:

| De | Para | Quem pode executar | Guard / condição |
|---|---|---|---|
| `NOVO` | `EM_NEGOCIACAO` | `member`, `owner` | — |
| `NOVO` | `CANCELADO` | `owner` | motivo obrigatório |
| `EM_NEGOCIACAO` | `PROPOSTA_ENVIADA` | `member`, `owner` | revisão ativa criada (RF-V2-11) |
| `EM_NEGOCIACAO` | `PERDIDO` | `member`, `owner` | motivo obrigatório |
| `EM_NEGOCIACAO` | `CANCELADO` | `owner` | motivo obrigatório |
| `PROPOSTA_ENVIADA` | `APROVADO` | `member`, `owner` | — |
| `PROPOSTA_ENVIADA` | `EM_NEGOCIACAO` | `member`, `owner` | motivo / anotação obrigatória |
| `PROPOSTA_ENVIADA` | `PERDIDO` | `member`, `owner` | motivo obrigatório |
| `PROPOSTA_ENVIADA` | `EXPIRADO` | sistema (cron) | `now > validUntil` |
| `PROPOSTA_ENVIADA` | `CANCELADO` | `owner` | motivo obrigatório |
| `APROVADO` | `FECHADO` | `member`, `owner` | — |
| `APROVADO` | `CANCELADO` | `owner` | motivo obrigatório |

Qualquer tentativa de transição fora desta tabela deve ser rejeitada com erro explícito — nunca ignorada silenciosamente. Toda transição ocorre dentro de uma transação de banco.

**Estados terminais** (`FECHADO`, `PERDIDO`, `CANCELADO`, `EXPIRADO`) são imutáveis: nenhuma transição de saída é permitida.

#### RF-V2-03 — Motivo obrigatório em caminhos negativos

Toda transição cujo destino seja `PERDIDO` ou `CANCELADO` exige um campo de motivo preenchido. A transição é bloqueada se o motivo estiver vazio. O motivo é persistido no log de auditoria (RF-V2-04) e pode ser exibido como leitura na tela da negociação.

#### RF-V2-04 — Log de auditoria de transições (`budget_status_log`)

Toda transição bem-sucedida gera um registro imutável com: estado anterior, estado novo, ator (userId + nome snapshot), motivo (quando aplicável) e timestamp. O log é exibido como linha do tempo na tela da negociação, abaixo do histórico de notas do RF35, identificado visualmente como evento de sistema (distinto das notas humanas). Registros do log não podem ser editados ou excluídos por nenhum papel.

**Schema:**
```typescript
export const budgetStatusLog = pgTable("budget_status_log", {
  id: text("id").primaryKey(),
  budgetId: text("budgetId")
    .notNull()
    .references(() => leadsBudgets.id, { onDelete: "cascade" }),
  fromStatus: text("fromStatus").notNull(),
  toStatus: text("toStatus").notNull(),
  actorUserId: text("actorUserId").references(() => user.id, {
    onDelete: "set null",
  }),
  actorName: text("actorName").notNull(), // snapshot
  reason: text("reason"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
```

---

### Bloco 2 — Congelamento de Preços

> **Depende de:** RF-V2-01 (máquina de estados)

#### RF-V2-05 — Snapshot de itens da proposta (`budget_proposal_items`)

No momento em que a negociação transita para `PROPOSTA_ENVIADA`, o sistema cria um snapshot dos itens e preços vigentes naquele instante. O snapshot é vinculado à revisão ativa (RF-V2-08). Alterações posteriores no catálogo de pacotes e serviços não afetam snapshots já criados.

O `totalValue` exibido na negociação a partir deste ponto é sempre recalculado a partir do snapshot, não do catálogo atual.

**Schema:**
```typescript
export const budgetProposalItems = pgTable("budget_proposal_items", {
  id: text("id").primaryKey(),
  revisionId: text("revisionId")
    .notNull()
    .references(() => budgetRevisions.id, { onDelete: "cascade" }),
  // Snapshot do pacote
  packageId: text("packageId").references(() => packages.id, {
    onDelete: "set null",
  }),
  packageName: text("packageName").notNull(),      // snapshot
  pricePerPerson: numeric("pricePerPerson", {
    precision: 10,
    scale: 2,
  }).notNull(),                                     // snapshot
  guestCount: integer("guestCount").notNull(),
  subtotal: numeric("subtotal", {
    precision: 12,
    scale: 2,
  }).notNull(),
  // Ajustes (descontos / taxas adicionais)
  adjustments: text("adjustments"),                 // JSON serializado
  totalValue: numeric("totalValue", {
    precision: 12,
    scale: 2,
  }).notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
```

#### RF-V2-06 — Exibição de preço restrita ao estado `PROPOSTA_ENVIADA` ou posterior

O valor total da negociação **não é exibido** nas telas de listagem e detalhe enquanto o status for `NOVO` ou `EM_NEGOCIACAO`. A partir de `PROPOSTA_ENVIADA`, o valor é sempre o do snapshot — nunca recalculado do catálogo. Esta regra vale apenas para a **visão interna do painel**; o formulário público continua exibindo a estimativa instantânea conforme RF18 atual.

---

### Bloco 3 — Expiração Automática de Propostas

> **Depende de:** RF-V2-01 (máquina de estados)

#### RF-V2-07 — Data de validade da proposta (`validUntil`)

Ao transitar para `PROPOSTA_ENVIADA`, o sistema registra uma data de validade (`validUntil`) na negociação. O padrão é **+7 dias corridos** a partir do envio, configurável pelo proprietário nas configurações da organização (mínimo 1 dia, máximo 30 dias). O campo é editável pelo `owner` enquanto o status for `PROPOSTA_ENVIADA`.

A data de validade é exibida em destaque na tela da negociação e na listagem (coluna ou badge), com alerta visual quando restam menos de 2 dias.

**Adição ao schema de `leads_budgets`:**
```typescript
validUntil: timestamp("validUntil"),
```

**Configuração do tenant — em `org_settings`, não em `organization`** (que pertence ao Better-Auth;
mesmo motivo pelo qual as configurações da página pública moram em `org_public_settings`):
```typescript
proposalValidityDays: integer("proposalValidityDays").notNull().default(7),
```

#### RF-V2-08 — Cron de expiração automática

Um job agendado (executado a cada hora) verifica negociações no estado `PROPOSTA_ENVIADA` cujo `validUntil` seja anterior ao momento atual e executa a transição para `EXPIRADO` via máquina de estados (RF-V2-02), gerando o registro de auditoria correspondente (RF-V2-04). A falha do cron em um ciclo não deve impedir ciclos subsequentes; erros são registrados em log da aplicação.

---

### Bloco 4 — Motor de Precificação Modular

> **Independente dos outros blocos. Pode ser implementado em paralelo.**

#### RF-V2-09 — Tipos de precificação para serviços avulsos

O cadastro de serviços (RF09–RF12 do MVP) passa a suportar 4 tipos de precificação além do valor fixo já existente:

| Tipo | Cálculo | Caso de uso |
|---|---|---|
| `FIXED` | Valor fixo independente de qualquer variável | Decoração básica, taxa de deslocamento |
| `PER_GUEST` | `basePrice × nº de convidados` | Garçom avulso, kit de boas-vindas |
| `PER_UNIT` | `basePrice × qtd. solicitada` (com min/max configuráveis) | Mesas extras, tendas |
| `PER_UNIT_AUTO` | `ceil(convidados / guestsPerUnit) × basePrice` | Garçons (1 a cada 20 pessoas), copeiras |

O tipo `TIERED` (faixas de preço por quantidade de convidados) fica reservado para v3.

O motor de cálculo é implementado como **funções puras** em `packages/shared` (o pacote de contratos deste repo), cobertas por testes unitários, sem dependência de banco ou framework.

**Adições ao schema de `items`:**
```typescript
pricingType: text("pricingType").notNull().default("FIXED"),
// PER_UNIT e PER_UNIT_AUTO
minQty: integer("minQty"),
maxQty: integer("maxQty"),
guestsPerUnit: integer("guestsPerUnit"),
```

#### RF-V2-10 — Ajustes de proposta (descontos e taxas)

O buffet pode adicionar ajustes ao total da proposta no momento da elaboração:

- **Desconto:** valor fixo (R$) ou percentual (%) sobre o subtotal.
- **Taxa adicional:** valor fixo ou percentual (ex: taxa de deslocamento, aluguel de espaço).

Ordem de aplicação: descontos primeiro, taxas depois. O total nunca pode ser negativo (mínimo R$ 0,00). Os ajustes são persistidos no snapshot da revisão (RF-V2-05) e exibidos como linha de detalhamento na proposta.

---

### Bloco 5 — Revisões Versionadas de Proposta

> **Depende de:** RF-V2-01 (máquina de estados) e RF-V2-05 (snapshot)

#### RF-V2-11 — Criação de revisões (`budget_revisions`)

Cada envio de proposta (transição `EM_NEGOCIACAO → PROPOSTA_ENVIADA` ou `PROPOSTA_ENVIADA → EM_NEGOCIACAO → PROPOSTA_ENVIADA`) cria uma nova revisão numerada sequencialmente (v1, v2, v3…). Cada revisão contém: número da versão, `validUntil`, o snapshot de itens (RF-V2-05), o snapshot dos ajustes (RF-V2-10), o total calculado, o autor e o timestamp de criação.

Apenas a **revisão mais recente** é considerada ativa para efeitos de expiração e aprovação. As anteriores são somente leitura.

**Schema:**
```typescript
export const budgetRevisions = pgTable("budget_revisions", {
  id: text("id").primaryKey(),
  budgetId: text("budgetId")
    .notNull()
    .references(() => leadsBudgets.id, { onDelete: "cascade" }),
  revisionNumber: integer("revisionNumber").notNull(), // 1, 2, 3…
  validUntil: timestamp("validUntil").notNull(),
  totalValue: numeric("totalValue", { precision: 12, scale: 2 }).notNull(),
  authorUserId: text("authorUserId").references(() => user.id, {
    onDelete: "set null",
  }),
  authorName: text("authorName").notNull(), // snapshot
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
```

#### RF-V2-12 — Histórico de revisões na tela da negociação

A tela da negociação exibe o histórico completo de revisões em ordem cronológica decrescente, com: número da versão, data de envio, autor, total, `validUntil` e status da revisão (ativa, expirada, superada). A revisão ativa é destacada visualmente. O buffet pode expandir qualquer revisão para ver o detalhamento de itens e ajustes daquela versão.

---

### Bloco 6 — Calendário de Disponibilidade no Portal Público

> **Independente dos outros blocos. Pode ser implementado em paralelo.**

#### RF-V2-13 — Status de disponibilidade por data (`date_availability`)

O proprietário pode definir o status de disponibilidade de qualquer data no calendário da organização:

| Status | Significado |
|---|---|
| `DISPONIVEL` | Data livre |
| `QUASE_CHEIO` | Já existe evento(s) nessa data, mas ainda aceita |
| `INDISPONIVEL` | Data bloqueada para novos orçamentos |

O padrão de qualquer data não configurada é `DISPONIVEL`.

**Schema:**
```typescript
export const dateAvailability = pgTable(
  "date_availability",
  {
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // formato "YYYY-MM-DD"
    status: text("status").notNull().default("DISPONIVEL"),
    note: text("note"), // observação interna opcional
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.date] }),
  ]
);
```

#### RF-V2-14 — Calendário visível no portal público

O formulário público de captação (RF18) passa a exibir um mini-calendário acima do campo de data do evento, mostrando os próximos 60 dias com a coloração de disponibilidade (🟢 disponível / 🟡 quase cheio / 🔴 indisponível). O calendário é **apenas informativo**: não bloqueia a seleção de nenhuma data, inclusive as marcadas como `INDISPONIVEL` — o cliente ainda pode submeter o formulário. A API que serve o calendário é pública (sem autenticação), escopada por `organizationId` resolvido via slug, e retorna apenas o status de cada data, sem expor dados de outros clientes.

#### RF-V2-15 — Atualização automática do calendário interno

O sistema atualiza automaticamente o status visual das datas na agenda interna (RF31 do MVP) com base nos registros de `date_availability`, de forma que a visão do painel e a do portal público sejam consistentes. O proprietário pode sobrescrever o status de qualquer data a qualquer momento.

---

## 🔒 Requisitos Não Funcionais

- **RNF-V2-01 — Transações atômicas nas transições de estado:** toda execução da máquina de estados (RF-V2-02) deve ocorrer dentro de uma transação de banco. Se qualquer passo falhar (criação do log, atualização do status, criação da revisão), a transação é revertida integralmente. O erro é relançado com tipo explícito (`InvalidTransitionError`, `GuardNotMetError`) — nunca silenciado.

- **RNF-V2-02 — Motor de precificação isolado e testado:** as funções de cálculo (RF-V2-09) residem em `packages/shared` sem dependência de banco, HTTP ou framework. Cobertura mínima: um teste por tipo de precificação, incluindo casos de borda (qtd. fora dos limites, arredondamentos).

- **RNF-V2-03 — Cron de expiração idempotente:** a execução repetida do job de expiração (RF-V2-08) sobre as mesmas negociações deve produzir o mesmo resultado sem duplicar logs ou lançar erros. O job opera em lote, processa no máximo 100 registros por ciclo e registra em log de aplicação o número de negociações expiradas a cada execução.

- **RNF-V2-04 — API do calendário público com cache:** o endpoint que serve o status de disponibilidade de datas (RF-V2-14) deve ser cacheado por no mínimo 5 minutos no servidor, dado que é chamado sem autenticação por qualquer visitante da página pública. O cache é invalidado ao salvar alterações em `date_availability`.

- **RNF-V2-05 — Imutabilidade do log de auditoria:** a tabela `budget_status_log` não expõe endpoint de deleção ou edição em nenhum papel, incluindo `owner`. No banco, a constraint é reforçada por ausência de colunas `updatedAt` e por política de permissão de banco (somente `INSERT` e `SELECT` para o role da aplicação).

- **RNF-V2-06 — Migração segura dos status existentes:** a migration que converte os valores de status do MVP para os estados formais deve ser reversível (up/down), executada em transação, e acompanhada de script de validação que confirma que nenhum registro ficou com status nulo ou inválido após a conversão.

---

## 📐 Impacto no Schema Existente

Resumo das alterações no banco para implementar a v2 completa:

| Tabela | Tipo | Motivo |
|---|---|---|
| `leads_budgets` | Alteração | Adicionar `validUntil`; restringir `status` a enum dos 8 estados formais |
| `org_settings` | Nova tabela | `proposalValidityDays` por tenant (RF-V2-07) |
| `items` | Alteração | Adicionar `pricingType`, `minQty`, `maxQty`, `guestsPerUnit` |
| `budget_status_log` | Nova tabela | Log de auditoria de transições (RF-V2-04) |
| `budget_revisions` | Nova tabela | Revisões versionadas de proposta (RF-V2-11) |
| `budget_proposal_items` | Nova tabela | Snapshot de itens por revisão (RF-V2-05) |
| `date_availability` | Nova tabela | Status de disponibilidade por data (RF-V2-13) |

---

## 🗺️ Ordem de Implementação Sugerida

```
Sprint 1 — Fundação
  └── RF-V2-01  Estados formais + migration segura
  └── RF-V2-02  Máquina de estados com guards e transações
  └── RF-V2-03  Motivo obrigatório em caminhos negativos
  └── RF-V2-04  Log de auditoria (budget_status_log)
  └── RNF-V2-01 Transações atômicas
  └── RNF-V2-06 Migration reversível + script de validação

Sprint 2 — Proposta e preços
  └── RF-V2-11  Schema budget_revisions
  └── RF-V2-05  Snapshot de itens (budget_proposal_items)
  └── RF-V2-09  Motor de precificação modular (packages/contracts)
  └── RF-V2-10  Ajustes de proposta (descontos e taxas)
  └── RF-V2-06  Restrição de exibição de preço por estado
  └── RNF-V2-02 Testes do motor de precificação

Sprint 3 — Revisões e validade
  └── RF-V2-11  Criação e versionamento de revisões
  └── RF-V2-12  Histórico de revisões na tela da negociação
  └── RF-V2-07  validUntil + configuração por tenant
  └── RF-V2-08  Cron de expiração automática
  └── RNF-V2-03 Idempotência do cron

Sprint 4 — Calendário público
  └── RF-V2-13  Schema date_availability + gestão no painel
  └── RF-V2-14  Calendário visível no portal público
  └── RF-V2-15  Consistência entre agenda interna e portal
  └── RNF-V2-04 Cache do endpoint público
```
