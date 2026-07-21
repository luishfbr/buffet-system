import { describe, it, expect } from "vitest";
import {
  createItemSchema,
  createPackageSchema,
  moneySchema,
} from "./dtos.js";

describe("catalog DTOs", () => {
  it("accepts a valid dish with category", () => {
    const r = createItemSchema.safeParse({
      name: "Salada",
      type: "dish",
      category: "entrada",
      basePrice: "25.00",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a category on a non-dish item (RF05/09)", () => {
    const r = createItemSchema.safeParse({
      name: "Coca",
      type: "drink",
      category: "entrada",
      basePrice: "8.00",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid money value", () => {
    expect(moneySchema.safeParse("10.999").success).toBe(false);
    expect(moneySchema.safeParse("abc").success).toBe(false);
    expect(moneySchema.safeParse("150.00").success).toBe(true);
  });

  it("defaults package itemIds to an empty array", () => {
    const r = createPackageSchema.safeParse({
      name: "Ouro",
      pricePerPerson: "150.00",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.itemIds).toEqual([]);
  });
});
