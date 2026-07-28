import { describe, it, expect } from "vitest";
import {
  toCents,
  fromCents,
  multiplyMoney,
  sumMoney,
  splitInstallments,
  computeBudgetTotal,
  fitsBudgetTotal,
  formatBRL,
} from "./money.js";

describe("money helpers", () => {
  it("parses money strings to cents", () => {
    expect(toCents("150.00")).toBe(15000);
    expect(toCents("150")).toBe(15000);
    expect(toCents("150.5")).toBe(15050);
    expect(toCents("0.01")).toBe(1);
  });

  it("rejects invalid money values", () => {
    expect(() => toCents("abc")).toThrow();
    expect(() => toCents("1.234")).toThrow();
  });

  it("formats cents back to fixed 2-decimal strings", () => {
    expect(fromCents(15000)).toBe("150.00");
    expect(fromCents(1)).toBe("0.01");
    expect(fromCents(0)).toBe("0.00");
  });

  it("computes budget total without float errors (RF18)", () => {
    // 0.1 * 3 would be 0.30000000000000004 in float
    expect(computeBudgetTotal("0.10", 3)).toBe("0.30");
    expect(computeBudgetTotal("150.00", 120)).toBe("18000.00");
  });

  it("sums a schedule of installments (RF23)", () => {
    expect(sumMoney(["6000.00", "6000.00", "6000.00"])).toBe("18000.00");
  });

  it("splits a total into installments summing exactly to the total (RF23)", () => {
    expect(splitInstallments("18000.00", 3)).toEqual([
      "6000.00",
      "6000.00",
      "6000.00",
    ]);
    // Uneven split distributes remainder cents to the first installments.
    const parts = splitInstallments("100.00", 3);
    expect(parts).toEqual(["33.34", "33.33", "33.33"]);
    expect(sumMoney(parts)).toBe("100.00");
  });

  it("split rejects a non-positive installment count", () => {
    expect(() => splitInstallments("100.00", 0)).toThrow();
  });

  it("multiply rejects non-integer quantities", () => {
    expect(() => multiplyMoney("10.00", 1.5)).toThrow();
  });

  it("formats BRL for pt-BR display", () => {
    expect(formatBRL("150.00")).toContain("150,00");
  });
});

describe("fitsBudgetTotal (teto do numeric(12,2))", () => {
  it("aceita um orçamento realista", () => {
    expect(fitsBudgetTotal(computeBudgetTotal("150.00", 200))).toBe(true);
  });

  it("aceita exatamente o teto da coluna", () => {
    expect(fitsBudgetTotal("9999999999.99")).toBe(true);
  });

  it("recusa o que estouraria a coluna", () => {
    expect(fitsBudgetTotal("10000000000.00")).toBe(false);
  });

  it("recusa o produto de preço alto × muitos convidados", () => {
    // pricePerPerson é numeric(10,2) e guestCount chega a 100.000.
    expect(fitsBudgetTotal(computeBudgetTotal("99999999.99", 100000))).toBe(false);
  });
});
