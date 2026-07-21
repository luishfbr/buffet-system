import { z } from "zod";
import {
  itemTypeSchema,
  leadStatusSchema,
  paymentMethodSchema,
  DISH_CATEGORIES,
} from "./domain.js";

/** A money value as a plain decimal string with up to 2 decimals, e.g. "150.00". */
export const moneySchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Valor monetário inválido");

// ============================================================
// Catalog: Items (dishes / drinks / services) — RF01–RF12
// ============================================================

export const createItemSchema = z
  .object({
    name: z.string().min(1, "Nome obrigatório").max(120),
    type: itemTypeSchema,
    category: z.enum(DISH_CATEGORIES).optional(),
    basePrice: moneySchema,
    isActive: z.boolean().optional(),
  })
  .refine((v) => v.type === "dish" || v.category === undefined, {
    message: "Categoria só se aplica a pratos",
    path: ["category"],
  });

export const updateItemSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  category: z.enum(DISH_CATEGORIES).nullable().optional(),
  basePrice: moneySchema.optional(),
  isActive: z.boolean().optional(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

// ============================================================
// Catalog: Packages (fixed price per guest) — RF13–RF16
// ============================================================

export const createPackageSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(120),
  description: z.string().max(500).optional(),
  pricePerPerson: moneySchema,
  itemIds: z.array(z.string()).default([]),
  isActive: z.boolean().optional(),
});

export const updatePackageSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  pricePerPerson: moneySchema.optional(),
  itemIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;

// ============================================================
// Public onboarding: pre-budget capture (RF18)
// ============================================================

export const createPublicLeadSchema = z.object({
  slug: z.string().min(1),
  customerName: z.string().min(1, "Informe seu nome").max(120),
  customerEmail: z.string().email("E-mail inválido").optional().or(z.literal("")),
  customerPhone: z.string().min(8, "Informe um WhatsApp válido").max(20),
  eventDate: z.string().datetime().optional().or(z.literal("")),
  guestCount: z.coerce.number().int().positive().max(100000).optional(),
  packageId: z.string().optional(),
  // Honeypot: must stay empty (RNF06). Bots tend to fill every field.
  website: z.string().max(0).optional(),
});

export type CreatePublicLeadInput = z.infer<typeof createPublicLeadSchema>;

// ============================================================
// Sales funnel: negotiation management (RF19–RF22)
// ============================================================

/**
 * Update a lead/negotiation from the internal panel. Every field is optional
 * (partial update): status transitions (RF19), free-text notes/history (RF20),
 * lost reason, and edits to the customer/event data. When packageId or
 * guestCount change, the server recomputes totalValue.
 */
export const updateLeadSchema = z.object({
  customerName: z.string().min(1, "Nome obrigatório").max(120).optional(),
  customerEmail: z
    .string()
    .email("E-mail inválido")
    .nullable()
    .optional()
    .or(z.literal("")),
  customerPhone: z.string().min(8, "WhatsApp inválido").max(20).optional(),
  eventDate: z.string().datetime().nullable().optional().or(z.literal("")),
  guestCount: z.coerce
    .number()
    .int()
    .positive()
    .max(100000)
    .nullable()
    .optional(),
  packageId: z.string().nullable().optional(),
  status: leadStatusSchema.optional(),
  notes: z.string().max(5000).nullable().optional(),
  lostReason: z.string().max(500).nullable().optional(),
});

export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

// ============================================================
// Financial module: payment schedule & settlement (RF23–RF24)
// ============================================================

/** A single installment: due date + amount (RF23). */
export const installmentSchema = z.object({
  dueDate: z.string().datetime("Data de vencimento inválida"),
  amount: moneySchema,
});

/**
 * Generate a payment schedule for an approved negotiation (RF23). One or more
 * installments (entrada + parcelas), each with a due date and amount.
 */
export const createScheduleSchema = z.object({
  installments: z
    .array(installmentSchema)
    .min(1, "Informe ao menos uma parcela")
    .max(60),
});

/**
 * Settle an installment (RF24): mark as paid, record the method and an optional
 * receipt link (link-only in the MVP — no file storage).
 */
export const payInstallmentSchema = z.object({
  paymentMethod: paymentMethodSchema,
  receiptUrl: z
    .string()
    .url("Link do comprovante inválido")
    .max(2000)
    // Defense-in-depth: only http(s) links (blocks javascript:/data: schemes).
    .refine((u) => /^https?:\/\//i.test(u), "Use um link http(s)")
    .optional()
    .or(z.literal("")),
});

export type InstallmentInput = z.infer<typeof installmentSchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type PayInstallmentInput = z.infer<typeof payInstallmentSchema>;
