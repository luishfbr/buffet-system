import { describe, it, expect } from "vitest";
import { buildProposalText } from "./proposal.js";
import { updateLeadSchema } from "./dtos.js";

describe("buildProposalText (RF22)", () => {
  it("interpolates every dynamic variable", () => {
    const text = buildProposalText({
      customerName: "Maria",
      organizationName: "Buffet Estrela",
      packageName: "Pacote Ouro",
      eventDate: "2026-09-15T00:00:00.000Z",
      guestCount: 120,
      totalValue: "18000.00",
    });
    expect(text).toContain("Olá, Maria!");
    expect(text).toContain("Buffet Estrela");
    expect(text).toContain("Pacote Ouro");
    expect(text).toContain("15/09/2026");
    expect(text).toContain("120");
    // Intl separates "R$" from the amount with a non-breaking space.
    expect(text).toContain("18.000,00");
  });

  it("falls back gracefully when optional data is missing", () => {
    const text = buildProposalText({ customerName: "João" });
    expect(text).toContain("Olá, João!");
    expect(text).toContain("nosso buffet");
    expect(text).toContain("a definir");
    expect(text).toContain("a combinar");
  });
});

describe("updateLeadSchema (RF19/RF20)", () => {
  it("accepts a status transition with a lost reason", () => {
    const r = updateLeadSchema.safeParse({
      status: "perdido",
      lostReason: "Preço acima do orçamento",
    });
    expect(r.success).toBe(true);
  });

  it("accepts free-text notes and coerces guestCount", () => {
    const r = updateLeadSchema.safeParse({
      notes: "Ligou pedindo desconto",
      guestCount: "80",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.guestCount).toBe(80);
  });

  it("rejects an unknown status", () => {
    expect(updateLeadSchema.safeParse({ status: "ganho" }).success).toBe(false);
  });
});
