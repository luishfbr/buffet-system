import {
  pgTable,
  text,
  timestamp,
  boolean,
  numeric,
  integer,
  primaryKey,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { generateId } from "./id.js";

// ==========================================
// 1. INFRAESTRUTURA & AUTENTICAÇÃO (Better-Auth Core)
// ==========================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  role: text("role"),
  banned: boolean("banned"),
  banReason: text("banReason"),
  banExpires: timestamp("banExpires"),
  // Última organização escolhida no seletor do painel. Restaurada ao criar a
  // sessão (ver `pickActiveOrganizationId` em @buffet/auth): sem isto, quem tem
  // mais de um buffet sempre reabre no vínculo mais antigo. `set null` para a
  // linha não apontar para um buffet excluído.
  lastOrganizationId: text("lastOrganizationId").references(
    (): AnyPgColumn => organization.id,
    { onDelete: "set null" }
  ),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  activeOrganizationId: text("activeOrganizationId"),
  impersonatedBy: text("impersonatedBy"),
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
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// ==========================================
// 2. MULTI-TENANCY (Better-Auth Organization Plugin)
// ==========================================

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  metadata: text("metadata"),
});

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [index("member_org_idx").on(table.organizationId)]
);

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
  // Required by the Better-Auth organization plugin (not in the original spec).
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// ==========================================
// 3. REGRAS DE NEGÓCIO DO BUFFET
// ==========================================

export const items = pgTable(
  "items",
  {
    id: text("id").primaryKey().$defaultFn(generateId),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // type: 'dish' | 'drink' | 'service'
    type: text("type").notNull(),
    // category (dishes only): 'entrada' | 'principal' | 'sobremesa'
    category: text("category"),
    basePrice: numeric("basePrice", { precision: 10, scale: 2 }).notNull(),
    /**
     * RF-V2-09: como o `basePrice` vira preço.
     * 'FIXED' | 'PER_GUEST' | 'PER_UNIT' | 'PER_UNIT_AUTO'.
     *
     * Default 'FIXED' preserva o comportamento do MVP para todo item já
     * cadastrado: valor fixo é exatamente o que eles eram.
     */
    pricingType: text("pricingType").notNull().default("FIXED"),
    /** Só 'PER_UNIT': limites da quantidade pedida na proposta. */
    minQty: integer("minQty"),
    maxQty: integer("maxQty"),
    /** Só 'PER_UNIT_AUTO': quantos convidados cada unidade atende. */
    guestsPerUnit: integer("guestsPerUnit"),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [index("items_org_idx").on(table.organizationId)]
);

export const packages = pgTable(
  "packages",
  {
    id: text("id").primaryKey().$defaultFn(generateId),
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
    // RF26: ordem e destaque na vitrine da página pública.
    sortOrder: integer("sortOrder").notNull().default(0),
    isFeatured: boolean("isFeatured").notNull().default(false),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [index("packages_org_idx").on(table.organizationId)]
);

// RF28: galeria de fotos do pacote (máx. 10). Sem organizationId — o isolamento
// vem do join com `packages`, como em package_items / financial_payments (RNF05).
export const packageImages = pgTable(
  "package_images",
  {
    id: text("id").primaryKey().$defaultFn(generateId),
    packageId: text("packageId")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    // A imagem de sortOrder 0 é a capa do pacote.
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [index("package_images_pkg_idx").on(table.packageId)]
);

// RF25/RF27: personalização da página pública. 1:1 com a organização — tabela
// própria em vez de colunas em `organization`, que pertence ao plugin Better-Auth.
export const orgPublicSettings = pgTable("org_public_settings", {
  organizationId: text("organizationId")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  // template: 'vitrine' | 'elegante' | 'direto'
  template: text("template").notNull().default("vitrine"),
  // theme: 'light' | 'dark'
  theme: text("theme").notNull().default("light"),
  // Chave de preset da paleta curada (BRAND_PRESETS em @buffet/shared), não hex.
  brandColor: text("brandColor").notNull().default("ambar"),
  logoUrl: text("logoUrl"),
  coverUrl: text("coverUrl"),
  headline: text("headline"),
  subheadline: text("subheadline"),
  about: text("about"),
  ctaLabel: text("ctaLabel"),
  showPrices: boolean("showPrices").notNull().default(true),
  whatsapp: text("whatsapp"),
  phone: text("phone"),
  email: text("email"),
  instagram: text("instagram"),
  city: text("city"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
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

export const leadsBudgets = pgTable(
  "leads_budgets",
  {
    id: text("id").primaryKey().$defaultFn(generateId),
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
    /**
     * RF-V2-01: 'novo' | 'em_negociacao' | 'proposta_enviada' | 'aprovado'
     * | 'fechado' | 'perdido' | 'cancelado' | 'expirado'.
     *
     * Continua `text`, mas agora com CHECK no banco (`leads_budgets_status_check`,
     * migration 0005). Só `LeadsService.transition` escreve aqui.
     */
    status: text("status").notNull(),
    lostReason: text("lostReason"),
    /**
     * RF-V2-07: validade da proposta ativa. Espelha `budget_revisions.validUntil`
     * da revisão mais recente — denormalizado para o cron de expiração poder
     * varrer por índice, sem join.
     */
    validUntil: timestamp("validUntil"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    index("leads_org_idx").on(table.organizationId),
    index("leads_org_status_idx").on(table.organizationId, table.status),
    index("leads_org_eventdate_idx").on(table.organizationId, table.eventDate),
  ]
);

export const financialPayments = pgTable(
  "financial_payments",
  {
    id: text("id").primaryKey().$defaultFn(generateId),
    budgetId: text("budgetId")
      .notNull()
      .references(() => leadsBudgets.id, { onDelete: "cascade" }),
    dueDate: timestamp("dueDate").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    // status: 'pendente' | 'pago'
    status: text("status").notNull(),
    // paymentMethod: 'pix' | 'cartao' | 'boleto'
    paymentMethod: text("paymentMethod"),
    paidAt: timestamp("paidAt"),
    receiptUrl: text("receiptUrl"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [index("payments_budget_idx").on(table.budgetId)]
);

/**
 * RF35: histórico de interações com carimbo de tempo e autoria — evolução do
 * RF20, que guardava tudo numa única coluna `notes` mutável.
 *
 * A coluna de texto continuava sendo um bug de dados, não só uma leitura fraca
 * do requisito: o funil é compartilhado entre todos os members, e dois deles
 * com a mesma negociação aberta faziam last-writer-wins — o segundo save
 * apagava a anotação do primeiro, sem aviso.
 *
 * Sem `organizationId`: o isolamento vem do join com `leads_budgets`, como em
 * `financial_payments` e `package_images` (RNF05).
 */
export const leadNotes = pgTable(
  "lead_notes",
  {
    id: text("id").primaryKey().$defaultFn(generateId),
    budgetId: text("budgetId")
      .notNull()
      .references(() => leadsBudgets.id, { onDelete: "cascade" }),
    // Nulo quando o autor foi removido, ou nas notas importadas do RF20.
    authorUserId: text("authorUserId").references(() => user.id, {
      onDelete: "set null",
    }),
    // Snapshot do nome: o histórico não pode perder a autoria se o usuário sair.
    authorName: text("authorName").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    index("lead_notes_budget_idx").on(table.budgetId, table.createdAt),
  ]
);

/**
 * RF-V2-07: configuração operacional do tenant.
 *
 * Tabela própria, e não colunas em `organization`, pelo mesmo motivo de
 * `org_public_settings`: `organization` pertence ao plugin do Better-Auth.
 */
export const orgSettings = pgTable("org_settings", {
  organizationId: text("organizationId")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  /** Validade padrão da proposta, em dias corridos (mín. 1, máx. 30). */
  proposalValidityDays: integer("proposalValidityDays").notNull().default(7),
});

/**
 * RF-V2-11: revisões versionadas da proposta.
 *
 * Cada envio cria uma revisão numerada. Só a **mais recente** vale para
 * expiração e aprovação; as anteriores são somente leitura — é o que permite
 * reenviar uma proposta sem apagar o que o cliente já tinha recebido.
 */
export const budgetRevisions = pgTable(
  "budget_revisions",
  {
    id: text("id").primaryKey().$defaultFn(generateId),
    budgetId: text("budgetId")
      .notNull()
      .references(() => leadsBudgets.id, { onDelete: "cascade" }),
    revisionNumber: integer("revisionNumber").notNull(),
    validUntil: timestamp("validUntil").notNull(),
    totalValue: numeric("totalValue", { precision: 12, scale: 2 }).notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    /** Ajustes congelados em JSON — o catálogo deles não existe fora daqui. */
    adjustments: text("adjustments"),
    authorUserId: text("authorUserId").references(() => user.id, {
      onDelete: "set null",
    }),
    authorName: text("authorName").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    index("budget_revisions_budget_idx").on(
      table.budgetId,
      table.revisionNumber
    ),
  ]
);

/**
 * RF-V2-05: snapshot dos itens de uma revisão.
 *
 * **Congelado.** Nome, preço e tipo de precificação são cópias do momento do
 * envio: reajustar o catálogo depois não move o valor de uma proposta que já
 * saiu. As FKs para catálogo são `set null` — o item pode ser excluído mais
 * tarde, e o snapshot continua contando a história com os dados de então.
 */
export const budgetProposalItems = pgTable(
  "budget_proposal_items",
  {
    id: text("id").primaryKey().$defaultFn(generateId),
    revisionId: text("revisionId")
      .notNull()
      .references(() => budgetRevisions.id, { onDelete: "cascade" }),
    packageId: text("packageId").references(() => packages.id, {
      onDelete: "set null",
    }),
    itemId: text("itemId").references(() => items.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    pricingType: text("pricingType").notNull(),
    basePrice: numeric("basePrice", { precision: 10, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    sortOrder: integer("sortOrder").notNull().default(0),
  },
  (table) => [
    index("budget_proposal_items_revision_idx").on(
      table.revisionId,
      table.sortOrder
    ),
  ]
);

/**
 * RF-V2-09/RF-V2-10: composição da proposta em elaboração.
 *
 * **Rascunho, não snapshot.** Estas linhas são editáveis enquanto a negociação
 * está viva; ao enviar a proposta (RF-V2-05) elas são congeladas em
 * `budget_proposal_items`, e alterar o catálogo depois disso não mexe mais no
 * que o cliente recebeu. Separar as duas tabelas é o que permite editar o
 * rascunho sem reescrever o histórico.
 *
 * Cada linha é **ou** um pacote **ou** um item avulso. Sem `onDelete` nas duas
 * FKs, de propósito: apagar do catálogo algo que está numa proposta em
 * andamento deve ser bloqueado pelo service (com "inative em vez de excluir"),
 * não sumir da proposta em silêncio — mesma escolha de `leads_budgets.packageId`.
 */
export const budgetLineItems = pgTable(
  "budget_line_items",
  {
    id: text("id").primaryKey().$defaultFn(generateId),
    budgetId: text("budgetId")
      .notNull()
      .references(() => leadsBudgets.id, { onDelete: "cascade" }),
    /**
     * `cascade` aqui é sobre a **organização inteira sumindo**, não sobre
     * excluir um item do catálogo: esse caminho é bloqueado pelo service, com
     * mensagem de "inative em vez de excluir". Sem a cascata, apagar um buffet
     * falhava com erro de FK, porque o Postgres não garante ordem entre os
     * ramos de uma mesma cascata.
     */
    packageId: text("packageId").references(() => packages.id, {
      onDelete: "cascade",
    }),
    itemId: text("itemId").references(() => items.id, { onDelete: "cascade" }),
    /** Só faz sentido em `PER_UNIT`; nos demais a quantidade é derivada. */
    quantity: integer("quantity"),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [index("budget_lines_budget_idx").on(table.budgetId, table.sortOrder)]
);

/**
 * RF-V2-10: descontos e taxas da proposta em elaboração.
 *
 * `value` é reais quando `mode = 'fixo'` e pontos percentuais quando
 * `'percentual'` ('10.00' = 10%) — sempre positivo, o sinal vem do `kind`.
 * A ordem de aplicação (descontos antes de taxas) é do motor de cálculo, não
 * desta tabela: `sortOrder` é só a ordem de exibição.
 */
export const budgetAdjustments = pgTable(
  "budget_adjustments",
  {
    id: text("id").primaryKey().$defaultFn(generateId),
    budgetId: text("budgetId")
      .notNull()
      .references(() => leadsBudgets.id, { onDelete: "cascade" }),
    // kind: 'desconto' | 'taxa'
    kind: text("kind").notNull(),
    // mode: 'fixo' | 'percentual'
    mode: text("mode").notNull(),
    value: numeric("value", { precision: 10, scale: 2 }).notNull(),
    label: text("label"),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    index("budget_adjustments_budget_idx").on(table.budgetId, table.sortOrder),
  ]
);

/**
 * RF-V2-04: log de auditoria das transições de estado.
 *
 * **Append-only, e isso é garantido no banco** (RNF-V2-05): a migration 0005
 * instala uma trigger `BEFORE UPDATE OR DELETE` que levanta exceção. Não existe
 * endpoint de escrita além do INSERT da transição, nem para `owner` — e a
 * ausência de `updatedAt` aqui é intencional, não esquecimento.
 *
 * Sem `organizationId`: isolamento pelo join com `leads_budgets` (RNF05), igual
 * a `lead_notes` e `financial_payments`.
 */
export const budgetStatusLog = pgTable(
  "budget_status_log",
  {
    id: text("id").primaryKey().$defaultFn(generateId),
    budgetId: text("budgetId")
      .notNull()
      .references(() => leadsBudgets.id, { onDelete: "cascade" }),
    fromStatus: text("fromStatus").notNull(),
    toStatus: text("toStatus").notNull(),
    // Nulo quando o ator é o sistema (cron de expiração, migração) ou quando o
    // usuário foi removido depois.
    actorUserId: text("actorUserId").references(() => user.id, {
      onDelete: "set null",
    }),
    // Snapshot do nome, pelo mesmo motivo de `lead_notes.authorName`.
    actorName: text("actorName").notNull(),
    // Obrigatório nos caminhos negativos (RF-V2-03) — a regra é do service.
    reason: text("reason"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    index("budget_status_log_budget_idx").on(table.budgetId, table.createdAt),
  ]
);

// ==========================================
// 4. RELATIONS (Drizzle relational queries)
// ==========================================

export const organizationRelations = relations(
  organization,
  ({ many, one }) => ({
    members: many(member),
    items: many(items),
    packages: many(packages),
    leadsBudgets: many(leadsBudgets),
    publicSettings: one(orgPublicSettings, {
      fields: [organization.id],
      references: [orgPublicSettings.organizationId],
    }),
  })
);

export const orgPublicSettingsRelations = relations(
  orgPublicSettings,
  ({ one }) => ({
    organization: one(organization, {
      fields: [orgPublicSettings.organizationId],
      references: [organization.id],
    }),
  })
);

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
}));

export const packagesRelations = relations(packages, ({ many, one }) => ({
  organization: one(organization, {
    fields: [packages.organizationId],
    references: [organization.id],
  }),
  packageItems: many(packageItems),
  images: many(packageImages),
}));

export const packageImagesRelations = relations(packageImages, ({ one }) => ({
  package: one(packages, {
    fields: [packageImages.packageId],
    references: [packages.id],
  }),
}));

export const itemsRelations = relations(items, ({ many, one }) => ({
  organization: one(organization, {
    fields: [items.organizationId],
    references: [organization.id],
  }),
  packageItems: many(packageItems),
}));

export const packageItemsRelations = relations(packageItems, ({ one }) => ({
  package: one(packages, {
    fields: [packageItems.packageId],
    references: [packages.id],
  }),
  item: one(items, {
    fields: [packageItems.itemId],
    references: [items.id],
  }),
}));

export const leadsBudgetsRelations = relations(
  leadsBudgets,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [leadsBudgets.organizationId],
      references: [organization.id],
    }),
    package: one(packages, {
      fields: [leadsBudgets.packageId],
      references: [packages.id],
    }),
    payments: many(financialPayments),
    notes: many(leadNotes),
    statusLog: many(budgetStatusLog),
    lineItems: many(budgetLineItems),
    adjustments: many(budgetAdjustments),
    revisions: many(budgetRevisions),
  })
);

export const budgetRevisionsRelations = relations(
  budgetRevisions,
  ({ one, many }) => ({
    budget: one(leadsBudgets, {
      fields: [budgetRevisions.budgetId],
      references: [leadsBudgets.id],
    }),
    items: many(budgetProposalItems),
  })
);

export const budgetProposalItemsRelations = relations(
  budgetProposalItems,
  ({ one }) => ({
    revision: one(budgetRevisions, {
      fields: [budgetProposalItems.revisionId],
      references: [budgetRevisions.id],
    }),
  })
);

export const budgetLineItemsRelations = relations(
  budgetLineItems,
  ({ one }) => ({
    budget: one(leadsBudgets, {
      fields: [budgetLineItems.budgetId],
      references: [leadsBudgets.id],
    }),
    package: one(packages, {
      fields: [budgetLineItems.packageId],
      references: [packages.id],
    }),
    item: one(items, {
      fields: [budgetLineItems.itemId],
      references: [items.id],
    }),
  })
);

export const budgetAdjustmentsRelations = relations(
  budgetAdjustments,
  ({ one }) => ({
    budget: one(leadsBudgets, {
      fields: [budgetAdjustments.budgetId],
      references: [leadsBudgets.id],
    }),
  })
);

export const leadNotesRelations = relations(leadNotes, ({ one }) => ({
  budget: one(leadsBudgets, {
    fields: [leadNotes.budgetId],
    references: [leadsBudgets.id],
  }),
  author: one(user, {
    fields: [leadNotes.authorUserId],
    references: [user.id],
  }),
}));

export const budgetStatusLogRelations = relations(
  budgetStatusLog,
  ({ one }) => ({
    budget: one(leadsBudgets, {
      fields: [budgetStatusLog.budgetId],
      references: [leadsBudgets.id],
    }),
    actor: one(user, {
      fields: [budgetStatusLog.actorUserId],
      references: [user.id],
    }),
  })
);

export const financialPaymentsRelations = relations(
  financialPayments,
  ({ one }) => ({
    budget: one(leadsBudgets, {
      fields: [financialPayments.budgetId],
      references: [leadsBudgets.id],
    }),
  })
);

// ==========================================
// 5. INFERRED TYPES
// ==========================================

export type User = typeof user.$inferSelect;
export type Organization = typeof organization.$inferSelect;
export type Member = typeof member.$inferSelect;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Package = typeof packages.$inferSelect;
export type NewPackage = typeof packages.$inferInsert;
export type LeadBudget = typeof leadsBudgets.$inferSelect;
export type NewLeadBudget = typeof leadsBudgets.$inferInsert;
export type LeadNote = typeof leadNotes.$inferSelect;
export type NewLeadNote = typeof leadNotes.$inferInsert;
export type BudgetStatusLog = typeof budgetStatusLog.$inferSelect;
export type NewBudgetStatusLog = typeof budgetStatusLog.$inferInsert;
export type BudgetLineItem = typeof budgetLineItems.$inferSelect;
export type NewBudgetLineItem = typeof budgetLineItems.$inferInsert;
export type BudgetAdjustment = typeof budgetAdjustments.$inferSelect;
export type NewBudgetAdjustment = typeof budgetAdjustments.$inferInsert;
export type BudgetRevision = typeof budgetRevisions.$inferSelect;
export type NewBudgetRevision = typeof budgetRevisions.$inferInsert;
export type BudgetProposalItem = typeof budgetProposalItems.$inferSelect;
export type NewBudgetProposalItem = typeof budgetProposalItems.$inferInsert;
export type OrgSettings = typeof orgSettings.$inferSelect;
export type FinancialPayment = typeof financialPayments.$inferSelect;
export type NewFinancialPayment = typeof financialPayments.$inferInsert;
export type PackageImage = typeof packageImages.$inferSelect;
export type NewPackageImage = typeof packageImages.$inferInsert;
export type OrgPublicSettings = typeof orgPublicSettings.$inferSelect;
export type NewOrgPublicSettings = typeof orgPublicSettings.$inferInsert;
