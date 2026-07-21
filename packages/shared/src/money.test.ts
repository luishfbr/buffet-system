import { describe, it, expect } from "vitest";
import {
  toCents,
  fromCents,
  multiplyMoney,
  sumMoney,
  computeBudgetTotal,
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

  it("multiply rejects non-integer quantities", () => {
    expect(() => multiplyMoney("10.00", 1.5)).toThrow();
  });

  it("formats BRL for pt-BR display", () => {
    expect(formatBRL("150.00")).toContain("150,00");
  });
});
