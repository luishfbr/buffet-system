import { describe, it, expect } from "vitest";
import {
  agendaRangeSchema,
  applyPricePolicy,
  createItemSchema,
  createPackageSchema,
  createPublicLeadSchema,
  payInstallmentSchema,
  moneySchema,
  updatePageSettingsSchema,
  presignUploadSchema,
  reorderPackageImagesSchema,
  type PublicPagePackage,
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

describe("page settings DTOs (RF25–RF27)", () => {
  it("distingue campo não enviado de campo limpo", () => {
    // `undefined` = update parcial não mexe; `""` = o usuário apagou o valor.
    const r = updatePageSettingsSchema.safeParse({ headline: "" });
    expect(r.success).toBe(true);
    expect(r.data?.headline).toBeNull();
    expect("about" in (r.data ?? {})).toBe(false);
  });

  it("apara espaços e normaliza o Instagram", () => {
    const r = updatePageSettingsSchema.safeParse({
      headline: "  Buffet Aurora  ",
      instagram: "https://instagram.com/@buffetaurora/",
    });
    expect(r.data?.headline).toBe("Buffet Aurora");
    expect(r.data?.instagram).toBe("buffetaurora");
  });

  it("rejeita template, tema e cor fora da paleta curada", () => {
    for (const patch of [
      { template: "revista" },
      { theme: "sepia" },
      { brandColor: "#ff00ff" },
    ]) {
      expect(updatePageSettingsSchema.safeParse(patch).success).toBe(false);
    }
  });

  it("rejeita URL de imagem que não seja http(s)", () => {
    const r = updatePageSettingsSchema.safeParse({
      logoUrl: "javascript:alert(1)",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita WhatsApp curto demais e aceita telefone formatado", () => {
    expect(updatePageSettingsSchema.safeParse({ whatsapp: "123" }).success).toBe(
      false
    );
    expect(
      updatePageSettingsSchema.safeParse({ whatsapp: "(11) 90000-0000" }).success
    ).toBe(true);
  });
});

describe("upload & gallery DTOs (RF28/RNF07)", () => {
  it("aceita só os formatos de imagem suportados", () => {
    expect(
      presignUploadSchema.safeParse({
        scope: "logo",
        contentType: "image/webp",
        size: 1024,
      }).success
    ).toBe(true);
    expect(
      presignUploadSchema.safeParse({
        scope: "logo",
        contentType: "image/svg+xml",
        size: 1024,
      }).success
    ).toBe(false);
  });

  it("recusa arquivo acima de 5 MB e escopo desconhecido", () => {
    expect(
      presignUploadSchema.safeParse({
        scope: "logo",
        contentType: "image/png",
        size: 6 * 1024 * 1024,
      }).success
    ).toBe(false);
    expect(
      presignUploadSchema.safeParse({
        scope: "banner",
        contentType: "image/png",
        size: 1024,
      }).success
    ).toBe(false);
  });

  it("limita a reordenação ao teto de fotos do pacote", () => {
    const ids = Array.from({ length: 11 }, (_, i) => `id-${i}`);
    expect(reorderPackageImagesSchema.safeParse({ ids }).success).toBe(false);
    expect(
      reorderPackageImagesSchema.safeParse({ ids: ids.slice(0, 10) }).success
    ).toBe(true);
  });
});

describe("applyPricePolicy (RF27)", () => {
  const packages: PublicPagePackage[] = [
    {
      id: "p1",
      name: "Prata",
      description: null,
      pricePerPerson: "120.00",
      isFeatured: false,
      images: [],
      includedItems: ["Entrada"],
    },
  ];

  it("mantém o preço quando o buffet publica preços", () => {
    expect(applyPricePolicy(packages, true)).toEqual(packages);
  });

  it("apaga o preço sem mexer no resto do pacote", () => {
    const [hidden] = applyPricePolicy(packages, false);
    expect(hidden?.pricePerPerson).toBeNull();
    expect(hidden?.includedItems).toEqual(["Entrada"]);
    // Não muta a lista de origem — a prévia reaplica a política a cada tecla.
    expect(packages[0]?.pricePerPerson).toBe("120.00");
  });
});

describe("agendaRangeSchema (RF31)", () => {
  const base = { from: "2026-09-01", to: "2026-09-30" };

  it("aceita um intervalo válido", () => {
    expect(agendaRangeSchema.safeParse(base).success).toBe(true);
  });

  it("recusa data fora do formato YYYY-MM-DD", () => {
    const result = agendaRangeSchema.safeParse({ ...base, from: "01/09/2026" });
    expect(result.success).toBe(false);
  });

  it("recusa intervalo invertido", () => {
    const result = agendaRangeSchema.safeParse({
      from: "2026-09-30",
      to: "2026-09-01",
    });
    expect(result.success).toBe(false);
  });

  it("aceita o mesmo dia nas duas pontas", () => {
    const result = agendaRangeSchema.safeParse({
      from: "2026-09-10",
      to: "2026-09-10",
    });
    expect(result.success).toBe(true);
  });

  it("recusa janela maior que 3 meses", () => {
    const result = agendaRangeSchema.safeParse({
      from: "2026-01-01",
      to: "2026-12-31",
    });
    expect(result.success).toBe(false);
  });

  it("aceita includeLost como texto (query string não tem boolean)", () => {
    const result = agendaRangeSchema.safeParse({ ...base, includeLost: "true" });
    expect(result.success).toBe(true);
    expect(result.success && result.data.includeLost).toBe("true");
  });
});
