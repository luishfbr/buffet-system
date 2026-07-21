/**
 * Money helpers.
 *
 * Postgres `numeric` columns are surfaced as strings by Drizzle. To avoid
 * floating-point rounding errors we do all arithmetic in integer cents and
 * only ever serialize back to a fixed 2-decimal string for storage/display.
 *
 * A "money string" here is always a plain decimal string like "150.00".
 */

/** Parse a money string (or number) into integer cents. Throws on invalid input. */
export function toCents(value: string | number): number {
  const normalized =
    typeof value === "number" ? value.toFixed(2) : value.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Invalid money value: "${value}"`);
  }
  const negative = normalized.startsWith("-");
  const [whole, frac = ""] = normalized.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return negative ? -cents : cents;
}

/** Format integer cents into a fixed 2-decimal money string, e.g. 15000 -> "150.00". */
export function fromCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

/** Multiply a per-unit money value by an integer quantity. */
export function multiplyMoney(unit: string | number, quantity: number): string {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`Quantity must be a non-negative integer: ${quantity}`);
  }
  return fromCents(toCents(unit) * quantity);
}

/** Sum a list of money values. */
export function sumMoney(values: Array<string | number>): string {
  return fromCents(values.reduce<number>((acc, v) => acc + toCents(v), 0));
}

/**
 * Split a total into `count` installments whose sum is exactly the total (RF23).
 * The remainder cents are distributed one-by-one to the first installments, so
 * e.g. "100.00" / 3 -> ["33.34", "33.33", "33.33"].
 */
export function splitInstallments(
  total: string | number,
  count: number
): string[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`Installment count must be a positive integer: ${count}`);
  }
  const cents = toCents(total);
  const base = Math.floor(cents / count);
  let remainder = cents - base * count;
  return Array.from({ length: count }, () => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return fromCents(base + extra);
  });
}

/** Compute a lead/budget total: pricePerPerson × guestCount (RF18). */
export function computeBudgetTotal(
  pricePerPerson: string | number,
  guestCount: number
): string {
  return multiplyMoney(pricePerPerson, guestCount);
}

/** Format a money string for pt-BR display, e.g. "150.00" -> "R$ 150,00". */
export function formatBRL(value: string | number): string {
  const cents = toCents(value);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}
