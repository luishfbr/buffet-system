import {
  pgTable,
  text,
  timestamp,
  boolean,
  numeric,
  integer,
  primaryKey,
  index,
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
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [index("packages_org_idx").on(table.organizationId)]
);

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
    // status: 'novo' | 'em_negociacao' | 'formalizando' | 'aprovado' | 'perdido'
    status: text("status").notNull(),
    lostReason: text("lostReason"),
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

// ==========================================
// 4. RELATIONS (Drizzle relational queries)
// ==========================================

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  items: many(items),
  packages: many(packages),
  leadsBudgets: many(leadsBudgets),
}));

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
export type FinancialPayment = typeof financialPayments.$inferSelect;
export type NewFinancialPayment = typeof financialPayments.$inferInsert;
