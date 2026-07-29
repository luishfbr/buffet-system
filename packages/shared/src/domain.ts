import { z } from "zod";

/**
 * Shared domain enums and constants used across api + web.
 * These mirror the string columns in the Drizzle schema (packages/db).
 */

// --- Roles (Better-Auth member roles) ---
export const MEMBER_ROLES = ["owner", "member"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Proprietário",
  member: "Funcionário",
};

// --- Catalog item types (RF01-RF12: unified `items` table via `type`) ---
export const ITEM_TYPES = ["dish", "drink", "service"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

// Categories only apply to dishes (entrada, principal, sobremesa)
export const DISH_CATEGORIES = ["entrada", "principal", "sobremesa"] as const;
export type DishCategory = (typeof DISH_CATEGORIES)[number];

// --- Lead / negotiation funnel status (RF19, RF-V2-01) ---
/**
 * Estados formais da negociação. A ordem é a do funil e é usada tal e qual pelas
 * abas de filtro e pelo quadro — não reordene sem olhar as duas telas.
 *
 * `formalizando` do MVP foi absorvido por `em_negociacao` na migration da v2:
 * o estado equivalente no novo modelo (`proposta_enviada`) exige revisão ativa e
 * `validUntil`, que os registros antigos não têm.
 */
export const LEAD_STATUSES = [
  "novo",
  "em_negociacao",
  "proposta_enviada",
  "aprovado",
  "fechado",
  "perdido",
  "cancelado",
  "expirado",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  novo: "Novo (Lead)",
  em_negociacao: "Em Negociação",
  proposta_enviada: "Proposta Enviada",
  aprovado: "Aprovado",
  fechado: "Fechado",
  perdido: "Perdido",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

/**
 * Encerramentos sem conversão. Substitui o `status !== "perdido"` que o MVP
 * espalhou pela agenda, pelo alerta de conflito (RF21) e pelo painel: com oito
 * estados, "não perdido" deixaria eventos cancelados e expirados contando como
 * compromisso de agenda.
 */
export const NEGATIVE_LEAD_STATUSES = [
  "perdido",
  "cancelado",
  "expirado",
] as const satisfies readonly LeadStatus[];

export function isNegativeLeadStatus(status: LeadStatus): boolean {
  return (NEGATIVE_LEAD_STATUSES as readonly LeadStatus[]).includes(status);
}

/**
 * Colunas do quadro (RF19) — derivado, não uma terceira lista à mão: é o funil
 * menos os encerramentos negativos. Eles viram lixeira que só cresce e espremem
 * as colunas onde o trabalho acontece; seguem acessíveis pelo filtro da tabela.
 */
export const LEAD_BOARD_STATUSES: readonly LeadStatus[] = LEAD_STATUSES.filter(
  (status) => !isNegativeLeadStatus(status)
);

/**
 * Cronograma de pagamentos (RF23) — **duas perguntas diferentes**, e confundi-las
 * foi o que quase deixou a v2 permitir criar cronograma numa negociação já
 * encerrada:
 *
 * - `canCreateSchedule`: gerar parcelas é um ato sobre negociação viva.
 * - `hasSchedule`: exibir o que já existe continua valendo depois de fechada.
 */
export function canCreateSchedule(status: LeadStatus): boolean {
  return status === "aprovado";
}

export function hasSchedule(status: LeadStatus): boolean {
  return status === "aprovado" || status === "fechado";
}

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

// ============================================================
// Public page customization (RF25–RF28 / RNF07)
// ============================================================

// --- Layouts (RF26) ---
export const PUBLIC_TEMPLATES = ["vitrine", "elegante", "direto"] as const;
export type PublicTemplate = (typeof PUBLIC_TEMPLATES)[number];

export const PUBLIC_TEMPLATE_LABELS: Record<PublicTemplate, string> = {
  vitrine: "Vitrine",
  elegante: "Elegante",
  direto: "Direto",
};

export const PUBLIC_TEMPLATE_DESCRIPTIONS: Record<PublicTemplate, string> = {
  vitrine:
    "Capa grande e um card com fotos por pacote. Para quem tem boas imagens do salão e dos pratos.",
  elegante:
    "Pacotes tipografados como um cardápio impresso, com pouca foto. Para casamentos e eventos formais.",
  direto:
    "Formulário ao lado do orçamento, que se atualiza enquanto o cliente digita. Para fechar rápido.",
};

// --- Tema da página (RF25) ---
export const PUBLIC_THEMES = ["light", "dark"] as const;
export type PublicTheme = (typeof PUBLIC_THEMES)[number];

export const PUBLIC_THEME_LABELS: Record<PublicTheme, string> = {
  light: "Claro",
  dark: "Escuro",
};

// --- Paleta curada (RF25) ---
export const BRAND_COLORS = [
  "ambar",
  "terracota",
  "borgonha",
  "oliva",
  "petroleo",
  "rose",
  "ameixa",
  "grafite",
] as const;
export type BrandColor = (typeof BRAND_COLORS)[number];

export interface BrandPreset {
  label: string;
  /** Cor da marca e o texto que fica legível sobre ela, por tema. */
  light: { brand: string; foreground: string };
  dark: { brand: string; foreground: string };
}

/**
 * Fonte única das cores de marca da página pública. Valores em oklch, no mesmo
 * vocabulário dos tokens de `apps/web/src/app/globals.css` — a página aplica o
 * par escolhido em `--brand` / `--brand-foreground` e todo o resto recolore.
 *
 * A paleta é curada (em vez de color picker livre) para garantir contraste AA
 * do texto sobre a cor nos dois temas; `domain.test.ts` verifica isso.
 * Regra: no tema escuro a marca é sempre clara, para destacar do fundo.
 */
export const BRAND_PRESETS: Record<BrandColor, BrandPreset> = {
  ambar: {
    label: "Âmbar",
    light: { brand: "oklch(0.78 0.155 70)", foreground: "oklch(0.2 0.02 65)" },
    dark: { brand: "oklch(0.8 0.16 70)", foreground: "oklch(0.2 0.02 65)" },
  },
  terracota: {
    label: "Terracota",
    light: { brand: "oklch(0.56 0.16 40)", foreground: "oklch(0.99 0.005 60)" },
    dark: { brand: "oklch(0.72 0.14 40)", foreground: "oklch(0.2 0.03 40)" },
  },
  borgonha: {
    label: "Borgonha",
    light: { brand: "oklch(0.45 0.16 15)", foreground: "oklch(0.99 0.005 60)" },
    dark: { brand: "oklch(0.7 0.15 15)", foreground: "oklch(0.18 0.03 15)" },
  },
  oliva: {
    label: "Oliva",
    light: { brand: "oklch(0.52 0.1 130)", foreground: "oklch(0.99 0.005 60)" },
    dark: { brand: "oklch(0.76 0.12 130)", foreground: "oklch(0.19 0.03 130)" },
  },
  petroleo: {
    label: "Petróleo",
    light: {
      brand: "oklch(0.52 0.09 220)",
      foreground: "oklch(0.99 0.005 60)",
    },
    dark: { brand: "oklch(0.76 0.1 220)", foreground: "oklch(0.19 0.03 220)" },
  },
  rose: {
    label: "Rosé",
    light: { brand: "oklch(0.75 0.09 15)", foreground: "oklch(0.22 0.03 15)" },
    dark: { brand: "oklch(0.8 0.09 15)", foreground: "oklch(0.2 0.03 15)" },
  },
  ameixa: {
    label: "Ameixa",
    light: {
      brand: "oklch(0.45 0.15 320)",
      foreground: "oklch(0.99 0.005 60)",
    },
    dark: { brand: "oklch(0.72 0.13 320)", foreground: "oklch(0.18 0.03 320)" },
  },
  grafite: {
    label: "Grafite",
    light: { brand: "oklch(0.35 0.02 60)", foreground: "oklch(0.99 0.005 60)" },
    dark: { brand: "oklch(0.82 0.012 60)", foreground: "oklch(0.2 0.012 60)" },
  },
};

// --- Upload de imagens (RNF07) ---
export const UPLOAD_SCOPES = ["logo", "cover", "package"] as const;
export type UploadScope = (typeof UPLOAD_SCOPES)[number];

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/** Extensão do objeto no bucket, derivada do content-type (nunca do nome do arquivo). */
export const IMAGE_EXTENSIONS: Record<AllowedImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Teto de fotos por pacote (RF28). */
export const MAX_PACKAGE_IMAGES = 10;

// Reusable zod enums
export const memberRoleSchema = z.enum(MEMBER_ROLES);
export const itemTypeSchema = z.enum(ITEM_TYPES);
export const leadStatusSchema = z.enum(LEAD_STATUSES);
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export const publicTemplateSchema = z.enum(PUBLIC_TEMPLATES);
export const publicThemeSchema = z.enum(PUBLIC_THEMES);
export const brandColorSchema = z.enum(BRAND_COLORS);
export const uploadScopeSchema = z.enum(UPLOAD_SCOPES);
