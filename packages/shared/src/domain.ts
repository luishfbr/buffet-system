import { z } from "zod";

/**
 * Shared domain enums and constants used across api + web.
 * These mirror the string columns in the Drizzle schema (packages/db).
 */

// --- Roles (Better-Auth member roles) ---
export const MEMBER_ROLES = ["owner", "member"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

// --- Catalog item types (RF01-RF12: unified `items` table via `type`) ---
export const ITEM_TYPES = ["dish", "drink", "service"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

// Categories only apply to dishes (entrada, principal, sobremesa)
export const DISH_CATEGORIES = ["entrada", "principal", "sobremesa"] as const;
export type DishCategory = (typeof DISH_CATEGORIES)[number];

// --- Lead / negotiation funnel status (RF19) ---
export const LEAD_STATUSES = [
  "novo",
  "em_negociacao",
  "formalizando",
  "aprovado",
  "perdido",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  novo: "Novo (Lead)",
  em_negociacao: "Em Negociação",
  formalizando: "Formalizando",
  aprovado: "Aprovado",
  perdido: "Perdido",
};

// --- Financial payment status & methods (RF23, RF24) ---
export const PAYMENT_STATUSES = ["pendente", "pago"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["pix", "cartao", "boleto"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "PIX",
  cartao: "Cartão",
  boleto: "Boleto",
};

// Reusable zod enums
export const memberRoleSchema = z.enum(MEMBER_ROLES);
export const itemTypeSchema = z.enum(ITEM_TYPES);
export const leadStatusSchema = z.enum(LEAD_STATUSES);
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
