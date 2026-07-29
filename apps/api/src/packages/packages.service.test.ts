import { describe, it, expect } from "vitest";
import { isValidOrder } from "./packages.service.js";

describe("isValidOrder (RF26 — ordem da vitrine)", () => {
  it("aceita a lista completa dos pacotes da organização", () => {
    expect(isValidOrder(["a", "b", "c"], 3)).toBe(true);
  });

  it("recusa ids repetidos", () => {
    expect(isValidOrder(["a", "a", "b"], 3)).toBe(false);
  });

  it("recusa id que não pertence à organização (RNF05)", () => {
    // "c" é de outro tenant: a query escopada devolve só 2 linhas.
    expect(isValidOrder(["a", "b", "c"], 2)).toBe(false);
  });
});
