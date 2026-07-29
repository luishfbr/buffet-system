import { z } from "zod";
import { fromCents, multiplyMoney, sumMoney, toCents } from "./money.js";

/**
 * Motor de precificação modular (RF-V2-09 / RNF-V2-02).
 *
 * Funções **puras**: sem banco, sem HTTP, sem framework. Toda aritmética passa
 * pelos helpers de `money.ts` — dinheiro é string decimal e nunca vira float.
 *
 * O servidor é a autoridade: o cliente calcula com estas mesmas funções só para
 * mostrar o total enquanto o usuário monta a proposta, e o servidor recalcula
 * antes de gravar. Ter uma implementação só é o que impede os dois divergirem.
 */

// ============================================================
// Tipos de precificação (RF-V2-09)
// ============================================================

export const PRICING_TYPES = [
  "FIXED",
  "PER_GUEST",
  "PER_UNIT",
  "PER_UNIT_AUTO",
] as const;
export type PricingType = (typeof PRICING_TYPES)[number];

export const PRICING_TYPE_LABELS: Record<PricingType, string> = {
  FIXED: "Valor fixo",
  PER_GUEST: "Por convidado",
  PER_UNIT: "Por quantidade",
  PER_UNIT_AUTO: "Por convidado, em lotes",
};

export const PRICING_TYPE_HINTS: Record<PricingType, string> = {
  FIXED: "Independe de convidados ou quantidade. Ex.: taxa de deslocamento.",
  PER_GUEST: "Multiplica pelo número de convidados. Ex.: kit de boas-vindas.",
  PER_UNIT: "Você informa a quantidade na proposta. Ex.: mesas extras, tendas.",
  PER_UNIT_AUTO:
    "A quantidade sai do número de convidados. Ex.: 1 garçom a cada 20 pessoas.",
};

export const pricingTypeSchema = z.enum(PRICING_TYPES);

/** `TIERED` (faixas por convidado) ficou reservado para a v3. */

// ============================================================
// Configuração de preço de um item do catálogo
// ============================================================

export interface PricingConfig {
  pricingType: PricingType;
  /** Preço base, string decimal. Significado depende do tipo. */
  basePrice: string;
  /** Só `PER_UNIT`: limites da quantidade que o usuário pode pedir. */
  minQty?: number | null;
  maxQty?: number | null;
  /** Só `PER_UNIT_AUTO`: quantos convidados cada unidade atende. */
  guestsPerUnit?: number | null;
}

export interface LinePriceInput extends PricingConfig {
  /** Convidados do evento. Necessário em `PER_GUEST` e `PER_UNIT_AUTO`. */
  guestCount?: number | null;
  /** Quantidade pedida. Só usada em `PER_UNIT`. */
  quantity?: number | null;
}

export interface LinePrice {
  /** Quantidade efetiva — **derivada** nos tipos automáticos. */
  quantity: number;
  /** `basePrice × quantity`, string decimal. */
  subtotal: string;
}

/**
 * Erro de cálculo com mensagem pt-BR pronta para o usuário. Tipo próprio para o
 * service distinguir "dado inválido do usuário" de bug — sem arrastar o Nest
 * (nem o HTTP) para dentro do pacote de contratos.
 */
export class PricingError extends Error {}

/**
 * Preço de uma linha da proposta.
 *
 * `PER_UNIT_AUTO` arredonda **para cima** (`ceil`): 45 convidados com 1 garçom a
 * cada 20 dá 3 garçons, não 2,25 — não existe fração de garçom, e arredondar
 * para baixo deixaria o evento sem cobertura.
 */
export function computeLinePrice(input: LinePriceInput): LinePrice {
  const quantity = resolveQuantity(input);
  return { quantity, subtotal: multiplyMoney(input.basePrice, quantity) };
}

function resolveQuantity(input: LinePriceInput): number {
  switch (input.pricingType) {
    case "FIXED":
      return 1;

    case "PER_GUEST":
      return requireGuests(input.guestCount, "Informe o número de convidados");

    case "PER_UNIT": {
      const qty = input.quantity ?? 0;
      if (!Number.isInteger(qty) || qty < 0) {
        throw new PricingError("Quantidade inválida");
      }
      const min = input.minQty ?? null;
      const max = input.maxQty ?? null;
      if (min !== null && qty < min) {
        throw new PricingError(`Quantidade mínima deste item é ${min}`);
      }
      if (max !== null && qty > max) {
        throw new PricingError(`Quantidade máxima deste item é ${max}`);
      }
      return qty;
    }

    case "PER_UNIT_AUTO": {
      const per = input.guestsPerUnit ?? 0;
      if (!Number.isInteger(per) || per < 1) {
        throw new PricingError(
          "Configure quantos convidados cada unidade atende"
        );
      }
      const guests = requireGuests(
        input.guestCount,
        "Informe o número de convidados"
      );
      return Math.ceil(guests / per);
    }
  }
}

function requireGuests(
  guestCount: number | null | undefined,
  message: string
): number {
  if (
    guestCount == null ||
    !Number.isInteger(guestCount) ||
    guestCount < 1
  ) {
    throw new PricingError(message);
  }
  return guestCount;
}

/**
 * A quantidade é escolhida pelo usuário ou derivada do evento? Usado pela UI
 * para decidir entre um campo editável e um número em leitura.
 */
export function quantityIsEditable(pricingType: PricingType): boolean {
  return pricingType === "PER_UNIT";
}

// ============================================================
// Ajustes: descontos e taxas (RF-V2-10)
// ============================================================

export const ADJUSTMENT_KINDS = ["desconto", "taxa"] as const;
export type AdjustmentKind = (typeof ADJUSTMENT_KINDS)[number];

export const ADJUSTMENT_MODES = ["fixo", "percentual"] as const;
export type AdjustmentMode = (typeof ADJUSTMENT_MODES)[number];

export const ADJUSTMENT_KIND_LABELS: Record<AdjustmentKind, string> = {
  desconto: "Desconto",
  taxa: "Taxa adicional",
};

export const adjustmentKindSchema = z.enum(ADJUSTMENT_KINDS);
export const adjustmentModeSchema = z.enum(ADJUSTMENT_MODES);

export interface Adjustment {
  kind: AdjustmentKind;
  mode: AdjustmentMode;
  /**
   * `fixo` → string decimal em reais. `percentual` → string decimal de 0 a 100
   * (`"10.00"` = 10%). Sempre positivo: o sinal vem do `kind`.
   */
  value: string;
  label?: string | null;
}

export interface AdjustmentBreakdown extends Adjustment {
  /** Quanto este ajuste moveu o total, em reais. Sempre positivo. */
  amount: string;
}

export interface AdjustedTotal {
  subtotal: string;
  discountTotal: string;
  feeTotal: string;
  total: string;
  breakdown: AdjustmentBreakdown[];
}

/**
 * Aplica ajustes sobre o subtotal (RF-V2-10).
 *
 * **Descontos primeiro, taxas depois** — e ambos os percentuais incidem sobre o
 * subtotal original, não em cascata. Aplicar uma taxa percentual sobre o valor
 * já descontado faria a taxa mudar sozinha ao mexer no desconto, que é
 * impossível de explicar para o cliente numa proposta.
 *
 * O total tem piso em R$ 0,00: desconto maior que o subtotal zera, não vira
 * dívida do buffet com o cliente.
 */
export function applyAdjustments(
  subtotal: string,
  adjustments: readonly Adjustment[]
): AdjustedTotal {
  const subtotalCents = toCents(subtotal);
  const breakdown: AdjustmentBreakdown[] = [];
  let discountCents = 0;
  let feeCents = 0;

  for (const adj of adjustments) {
    const cents = adjustmentCents(subtotalCents, adj);
    breakdown.push({ ...adj, amount: fromCents(cents) });
    if (adj.kind === "desconto") discountCents += cents;
    else feeCents += cents;
  }

  // O piso é aplicado depois do desconto e antes da taxa: a taxa incide sobre o
  // que sobrou, e um total negativo nunca chega a existir.
  const afterDiscount = Math.max(0, subtotalCents - discountCents);
  return {
    subtotal: fromCents(subtotalCents),
    discountTotal: fromCents(discountCents),
    feeTotal: fromCents(feeCents),
    total: fromCents(afterDiscount + feeCents),
    breakdown,
  };
}

function adjustmentCents(subtotalCents: number, adj: Adjustment): number {
  const value = toCents(adj.value);
  if (value < 0) {
    throw new PricingError("O valor do ajuste não pode ser negativo");
  }
  if (adj.mode === "fixo") return value;

  // Percentual: `value` está em centésimos de ponto percentual (toCents de
  // "10.00" = 1000), então dividir por 10.000 devolve a fração. Arredondamento
  // meio-para-cima, o mesmo que o usuário faz de cabeça.
  if (value > toCents("100.00")) {
    throw new PricingError("O percentual não pode passar de 100%");
  }
  return Math.round((subtotalCents * value) / 10_000);
}

// ============================================================
// Total da proposta
// ============================================================

export interface ProposalLineInput extends LinePriceInput {
  /** Identificador de quem chama — devolvido intacto, para casar as linhas. */
  id: string;
  name: string;
}

export interface ProposalLine extends LinePrice {
  id: string;
  name: string;
}

export interface ProposalTotals extends AdjustedTotal {
  lines: ProposalLine[];
}

/**
 * Total completo de uma proposta: linhas + ajustes. É esta função que a API
 * chama ao congelar o snapshot (RF-V2-05) e que a UI chama a cada tecla.
 */
export function computeProposalTotals(
  lines: readonly ProposalLineInput[],
  adjustments: readonly Adjustment[]
): ProposalTotals {
  const priced = lines.map((line) => ({
    id: line.id,
    name: line.name,
    ...computeLinePrice(line),
  }));
  const subtotal = sumMoney(priced.map((l) => l.subtotal));
  return { lines: priced, ...applyAdjustments(subtotal, adjustments) };
}
