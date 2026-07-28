import { z } from "zod";
import {
  itemTypeSchema,
  leadStatusSchema,
  paymentMethodSchema,
  publicTemplateSchema,
  publicThemeSchema,
  brandColorSchema,
  uploadScopeSchema,
  DISH_CATEGORIES,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_PACKAGE_IMAGES,
  type PublicTemplate,
  type PublicTheme,
  type BrandColor,
  type LeadStatus,
  type MemberRole,
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
  // RF26: posição e destaque na vitrine da página pública.
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isFeatured: z.boolean().optional(),
});

export const updatePackageSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  pricePerPerson: moneySchema.optional(),
  itemIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isFeatured: z.boolean().optional(),
});

/** Nova ordem dos pacotes na vitrine pública (RF26) — ids na sequência desejada. */
export const reorderPackagesSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Informe a nova ordem"),
});

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;
export type ReorderPackagesInput = z.infer<typeof reorderPackagesSchema>;

// ============================================================
// Public onboarding: pre-budget capture (RF18)
// ============================================================

export const createPublicLeadSchema = z.object({
  slug: z.string().min(1),
  customerName: z.string().min(1, "Informe seu nome").max(120),
  customerEmail: z
    .string()
    .email("E-mail inválido")
    .optional()
    .or(z.literal("")),
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

// ============================================================
// Public page: customization & image upload (RF25–RF28 / RNF07)
// ============================================================

/**
 * URL de uma imagem já hospedada no bucket. O formato é validado aqui; que a
 * URL pertence ao bucket **e ao prefixo da própria organização** é verificado
 * no servidor (`UploadsService.assertOwnedAssetUrl`) — este schema sozinho não
 * impede apontar para um host qualquer.
 */
export const assetUrlSchema = z
  .string()
  .url("Link de imagem inválido")
  .max(2000)
  // Defense-in-depth: only http(s) links (blocks javascript:/data: schemes).
  .refine((u) => /^https?:\/\//i.test(u), "Use um link http(s)");

/**
 * Campo de texto opcional vindo de formulário. `undefined` = não enviado (o
 * update parcial não mexe nele); `""` ou `null` = o usuário limpou o campo.
 */
const optionalText = (max: number, message?: string) =>
  z
    .string()
    .max(max, message)
    .nullable()
    .optional()
    .transform((v) =>
      v === undefined ? undefined : v === null ? null : v.trim() || null
    );

const optionalPhone = (label: string) =>
  optionalText(20, `${label} muito longo`).refine(
    (v) => v == null || v.replace(/\D/g, "").length >= 8,
    `${label} inválido`
  );

const optionalAssetUrl = z
  .union([assetUrlSchema, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v || null));

/** Personalização da página pública `/{slug}` (RF25–RF27). Update parcial. */
export const updatePageSettingsSchema = z.object({
  template: publicTemplateSchema.optional(),
  theme: publicThemeSchema.optional(),
  brandColor: brandColorSchema.optional(),
  logoUrl: optionalAssetUrl,
  coverUrl: optionalAssetUrl,
  headline: optionalText(120, "Título muito longo"),
  subheadline: optionalText(200, "Subtítulo muito longo"),
  about: optionalText(1000, "Texto muito longo"),
  ctaLabel: optionalText(40, "Rótulo muito longo"),
  showPrices: z.boolean().optional(),
  whatsapp: optionalPhone("WhatsApp"),
  phone: optionalPhone("Telefone"),
  email: optionalText(160).refine(
    (v) => v == null || z.string().email().safeParse(v).success,
    "E-mail inválido"
  ),
  // Aceita "@perfil" ou a URL completa; guarda só o nome de usuário.
  instagram: optionalText(60, "Perfil muito longo").transform((v) =>
    v == null
      ? v
      : v
          .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
          .replace(/^@+/, "")
          .replace(/\/+$/, "") || null
  ),
  city: optionalText(120, "Cidade muito longa"),
});

export type UpdatePageSettingsInput = z.infer<typeof updatePageSettingsSchema>;

/** Pedido de URL pré-assinada para upload direto ao bucket (RNF07). */
export const presignUploadSchema = z.object({
  scope: uploadScopeSchema,
  contentType: z.enum(ALLOWED_IMAGE_TYPES, {
    errorMap: () => ({
      message: "Formato não suportado. Use JPG, PNG ou WebP.",
    }),
  }),
  size: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_IMAGE_BYTES, "Imagem maior que 5 MB"),
});

export const deleteAssetSchema = z.object({ url: assetUrlSchema });

export type PresignUploadInput = z.infer<typeof presignUploadSchema>;
export type DeleteAssetInput = z.infer<typeof deleteAssetSchema>;

/** Galeria de fotos do pacote (RF28). */
export const addPackageImageSchema = z.object({ url: assetUrlSchema });

export const reorderPackageImagesSchema = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1, "Informe a nova ordem")
    .max(MAX_PACKAGE_IMAGES),
});

export type AddPackageImageInput = z.infer<typeof addPackageImageSchema>;
export type ReorderPackageImagesInput = z.infer<
  typeof reorderPackageImagesSchema
>;

// ============================================================
// Public page: response contract (RF17/RF18 + RF25–RF28)
// ============================================================

/**
 * Payload de `GET /public/orgs/:slug` — contrato único entre a API e a página
 * `/{slug}`. Dinheiro como string decimal, datas em ISO (ver CLAUDE.md).
 */
export interface PublicPagePackage {
  id: string;
  name: string;
  description: string | null;
  /** Ausente quando o buffet optou por não exibir preços (`showPrices: false`). */
  pricePerPerson: string | null;
  isFeatured: boolean;
  images: string[];
  /** Nomes dos itens inclusos, para o buffet mostrar o que compõe o pacote. */
  includedItems: string[];
}

export interface PublicPageSettings {
  template: PublicTemplate;
  theme: PublicTheme;
  brandColor: BrandColor;
  logoUrl: string | null;
  coverUrl: string | null;
  headline: string | null;
  subheadline: string | null;
  about: string | null;
  ctaLabel: string | null;
  showPrices: boolean;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  city: string | null;
}

export interface PublicPageData {
  id: string;
  name: string;
  slug: string;
  settings: PublicPageSettings;
  packages: PublicPagePackage[];
}

/**
 * Valores usados enquanto a organização não personalizou nada — a linha em
 * `org_public_settings` só nasce no primeiro save. Espelha os defaults das
 * colunas no schema Drizzle.
 */
export const DEFAULT_PAGE_SETTINGS: PublicPageSettings = {
  template: "vitrine",
  theme: "light",
  brandColor: "ambar",
  logoUrl: null,
  coverUrl: null,
  headline: null,
  subheadline: null,
  about: null,
  ctaLabel: null,
  showPrices: true,
  whatsapp: null,
  phone: null,
  email: null,
  instagram: null,
  city: null,
};

/** Textos exibidos quando o buffet não escreveu os seus (RF27). */
export const PAGE_COPY_FALLBACKS = {
  subheadline: "Monte seu evento e receba um orçamento na hora.",
  ctaLabel: "Pedir orçamento",
} as const;

/**
 * RF27: com `showPrices: false` o preço nem sai da API. Fica aqui, e não solto
 * no `PublicService`, porque a prévia do editor aplica a mesma regra sobre o
 * rascunho em memória — a política de preço tem que ser uma só.
 */
export function applyPricePolicy(
  packages: PublicPagePackage[],
  showPrices: boolean
): PublicPagePackage[] {
  if (showPrices) return packages;
  return packages.map((pkg) => ({ ...pkg, pricePerPerson: null }));
}

// ==========================================
// Histórico de interações (RF35, evolui RF20)
// ==========================================

export const createLeadNoteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Escreva a anotação")
    .max(5000, "Máximo de 5000 caracteres"),
});

export type CreateLeadNoteInput = z.infer<typeof createLeadNoteSchema>;

/**
 * Um registro do histórico (RF35). `authorName` é um **snapshot**: se o
 * funcionário sair da equipe, a autoria da anotação não se perde.
 */
export interface LeadNoteView {
  id: string;
  body: string;
  authorName: string;
  /** Carimbo de tempo real — renderizado em horário local, não em UTC. */
  createdAt: string;
}

// ==========================================
// Agenda de eventos (RF31)
// ==========================================

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Janela máxima consultável de uma vez, em dias (~3 meses). */
export const AGENDA_MAX_RANGE_DAYS = 92;

/** Dias inteiros entre duas datas `YYYY-MM-DD`, em UTC. */
function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  return (end - start) / 86_400_000;
}

export const agendaRangeSchema = z
  .object({
    from: z.string().regex(ISO_DATE, "Data inicial inválida"),
    to: z.string().regex(ISO_DATE, "Data final inválida"),
    // Query string chega como texto — nada de z.boolean() aqui.
    includeLost: z.enum(["true", "false"]).optional(),
  })
  .refine((v) => v.to >= v.from, {
    message: "A data final deve ser igual ou posterior à inicial",
    path: ["to"],
  })
  .refine((v) => daysBetween(v.from, v.to) <= AGENDA_MAX_RANGE_DAYS, {
    message: "Intervalo máximo de 3 meses",
    path: ["to"],
  });

export type AgendaRangeInput = z.infer<typeof agendaRangeSchema>;

/**
 * Um evento na agenda (RF31). A resposta é uma **lista plana**: o agrupamento
 * por dia e o conflito ("mais de um evento no mesmo dia") são derivados no
 * cliente. Agrupar no servidor criaria um segundo lugar codificando a regra de
 * conflito, que já vive no `countDateConflicts` do RF21.
 */
export interface AgendaEvent {
  id: string;
  customerName: string;
  eventDate: string;
  guestCount: number | null;
  status: LeadStatus;
  totalValue: string | null;
  packageName: string | null;
}

export interface AgendaResponse {
  events: AgendaEvent[];
  /**
   * Negociações sem data definida — não cabem na agenda, mas some-las sem
   * dizer nada faz o usuário achar que elas desapareceram.
   */
  undatedCount: number;
}

// ==========================================
// Painel operacional (RF29 / RF30)
// ==========================================

/** Um evento próximo, já com o aviso de conflito de data resolvido (RF21). */
export interface DashboardUpcomingEvent {
  id: string;
  customerName: string;
  eventDate: string;
  guestCount: number | null;
  status: LeadStatus;
  /** Há outro evento não perdido no mesmo dia UTC — mesma regra do RF21. */
  hasConflict: boolean;
}

/** Uma parcela a vencer, com o cliente já resolvido. Só para `owner` (RNF04). */
export interface DashboardUpcomingPayment {
  id: string;
  budgetId: string;
  customerName: string;
  dueDate: string;
  amount: string;
  /** Vencida: `dueDate` no passado e ainda pendente. */
  isOverdue: boolean;
}

/**
 * Totais financeiros do painel. **Ausente (`null`) para `member`** — o RNF04
 * proíbe totalizador de receita para funcionário, e a regra é aplicada no
 * service: o bloco nem chega a ser consultado.
 */
export interface DashboardFinance {
  receivable: string;
  received: string;
  overdueCount: number;
  nextDue: DashboardUpcomingPayment[];
}

/** Contagens cruas do catálogo — o percentual é derivado no cliente (RF30). */
export interface DashboardCatalogCounts {
  dish: number;
  drink: number;
  service: number;
  packages: number;
  packagesWithPhotos: number;
}

/** Resposta de `GET /dashboard/summary` (RF29). */
export interface DashboardSummary {
  leads: {
    byStatus: Record<LeadStatus, number>;
    total: number;
    newLast7Days: number;
  };
  upcomingEvents: DashboardUpcomingEvent[];
  catalog: DashboardCatalogCounts;
  /** A organização já salvou a personalização da página pública (RF25–RF27). */
  pagePublished: boolean;
  membersCount: number;
  finance: DashboardFinance | null;
}

/** Resposta de `GET /dashboard/badges` — contadores da navegação (RF29). */
export interface DashboardBadges {
  newLeads: number;
  /** `null` para `member` (RNF04). */
  overduePayments: number | null;
}

// ==========================================
// Workspace do usuário (multi-organização)
// ==========================================

/** Um buffet do qual o usuário participa, com o papel dele nele (RNF04). */
export interface WorkspaceOrganization {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  role: MemberRole;
}

/** Convite pendente endereçado ao e-mail do usuário logado (RF34). */
export interface WorkspaceInvitation {
  id: string;
  organizationId: string;
  organizationName: string;
  role: MemberRole;
  inviterName: string | null;
  /** ISO — carimbo de tempo real, renderize em horário local. */
  expiresAt: string;
}

/**
 * Resposta de `GET /me/workspace`. É a **verdade do servidor** sobre onde o
 * usuário pode entrar: o front decide o destino pós-login a partir daqui, em vez
 * de confiar no cache do client do Better-Auth (RNF05).
 */
export interface Workspace {
  /** `null` quando o usuário ainda não tem nenhum vínculo vivo. */
  activeOrganizationId: string | null;
  organizations: WorkspaceOrganization[];
  invitations: WorkspaceInvitation[];
}

/** Corpo de `POST /me/active-organization` — troca de buffet no seletor. */
export const setActiveOrganizationSchema = z.object({
  organizationId: z.string().min(1, "Informe a organização"),
});
export type SetActiveOrganizationInput = z.infer<
  typeof setActiveOrganizationSchema
>;
