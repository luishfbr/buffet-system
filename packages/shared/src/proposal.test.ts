import { describe, it, expect } from "vitest";
import { buildProposalText } from "./proposal.js";
import { transitionLeadSchema, updateLeadSchema } from "./dtos.js";

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

describe("updateLeadSchema (RF19, revisado pelo RF-V2-02)", () => {
  it("coerce guestCount vindo como texto", () => {
    const r = updateLeadSchema.safeParse({ guestCount: "80" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.guestCount).toBe(80);
  });

  /**
   * A fronteira que a v2 fecha: status, motivo e a coluna legada `notes` saíram
   * do update. O Zod descarta chave desconhecida em silêncio, então o teste
   * afirma o **resultado** — o campo não chega no `data`, e portanto o service
   * não tem como gravá-lo. Aceitá-los aqui deixaria aberto o caminho de escrever
   * qualquer status direto, sem transição válida nem auditoria.
   */
  it("descarta status, lostReason e notes — mudar de estado é POST /transitions", () => {
    const r = updateLeadSchema.safeParse({
      customerName: "Maria",
      status: "aprovado",
      lostReason: "qualquer coisa",
      notes: "texto legado do RF20",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({ customerName: "Maria" });
    }
  });
});

describe("transitionLeadSchema (RF-V2-02/RF-V2-03)", () => {
  it("aceita destino válido sem motivo", () => {
    const r = transitionLeadSchema.safeParse({ to: "em_negociacao" });
    expect(r.success).toBe(true);
  });

  it("rejeita um estado que não existe", () => {
    expect(transitionLeadSchema.safeParse({ to: "ganho" }).success).toBe(false);
    // "formalizando" existiu no MVP e sobrevive no log de auditoria, mas não é
    // mais um destino possível.
    expect(
      transitionLeadSchema.safeParse({ to: "formalizando" }).success
    ).toBe(false);
  });

  /**
   * O schema não sabe de qual estado a negociação parte, então não tem como
   * saber se o motivo é obrigatório — quem decide isso é o servidor, contra a
   * tabela de transições. Aqui o motivo é sempre opcional, e o `trim` garante
   * que espaço em branco chegue vazio do outro lado.
   */
  it("normaliza o motivo e o mantém opcional", () => {
    const r = transitionLeadSchema.safeParse({ to: "perdido", reason: "  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.reason).toBe("");
  });

  it("limita o motivo a 500 caracteres", () => {
    const r = transitionLeadSchema.safeParse({
      to: "perdido",
      reason: "x".repeat(501),
    });
    expect(r.success).toBe(false);
  });
});
