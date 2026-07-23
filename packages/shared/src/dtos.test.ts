import { describe, it, expect } from "vitest";
import {
  createItemSchema,
  createPackageSchema,
  createPublicLeadSchema,
  payInstallmentSchema,
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

describe("public lead DTO (RF18 / RNF06)", () => {
  const base = {
    slug: "buffet-x",
    customerName: "Cliente",
    customerPhone: "11999999999",
  };

  it("accepts a minimal valid lead and coerces guestCount", () => {
    const r = createPublicLeadSchema.safeParse({ ...base, guestCount: "120" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.guestCount).toBe(120);
  });

  it("rejects a filled honeypot (website must be empty)", () => {
    const r = createPublicLeadSchema.safeParse({
      ...base,
      website: "http://spam",
    });
    expect(r.success).toBe(false);
  });

  it("requires name and phone", () => {
    expect(
      createPublicLeadSchema.safeParse({ slug: "x", customerName: "" }).success
    ).toBe(false);
  });
});

describe("payInstallmentSchema (RF24)", () => {
  it("accepts an http(s) receipt link", () => {
    expect(
      payInstallmentSchema.safeParse({
        paymentMethod: "pix",
        receiptUrl: "https://comprovante.example/abc",
      }).success
    ).toBe(true);
  });

  it("rejects a non-http scheme (defense-in-depth)", () => {
    expect(
      payInstallmentSchema.safeParse({
        paymentMethod: "pix",
        receiptUrl: "javascript:alert(1)",
      }).success
    ).toBe(false);
  });
});
