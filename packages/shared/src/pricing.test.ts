import { describe, expect, it } from "vitest";
import {
  PRICING_TYPES,
  PricingError,
  applyAdjustments,
  computeLinePrice,
  computeProposalTotals,
  quantityIsEditable,
  type Adjustment,
} from "./pricing.js";

describe("computeLinePrice — um teste por tipo (RNF-V2-02)", () => {
  it("FIXED ignora convidados e quantidade", () => {
    const r = computeLinePrice({
      pricingType: "FIXED",
      basePrice: "250.00",
      guestCount: 500,
      quantity: 9,
    });
    expect(r).toEqual({ quantity: 1, subtotal: "250.00" });
  });

  it("PER_GUEST multiplica pelos convidados", () => {
    expect(
      computeLinePrice({
        pricingType: "PER_GUEST",
        basePrice: "12.50",
        guestCount: 80,
      })
    ).toEqual({ quantity: 80, subtotal: "1000.00" });
  });

  it("PER_UNIT usa a quantidade pedida", () => {
    expect(
      computeLinePrice({
        pricingType: "PER_UNIT",
        basePrice: "80.00",
        quantity: 3,
      })
    ).toEqual({ quantity: 3, subtotal: "240.00" });
  });

  it("PER_UNIT_AUTO deriva a quantidade dos convidados", () => {
    expect(
      computeLinePrice({
        pricingType: "PER_UNIT_AUTO",
        basePrice: "180.00",
        guestCount: 40,
        guestsPerUnit: 20,
      })
    ).toEqual({ quantity: 2, subtotal: "360.00" });
  });
});

describe("PER_UNIT_AUTO — arredondamento", () => {
  /**
   * Para cima, sempre: 45 convidados a 1 garçom por 20 dá 3, não 2. Não existe
   * fração de garçom, e arredondar para baixo deixa o evento descoberto.
   */
  it("arredonda para cima na sobra", () => {
    const q = (guests: number) =>
      computeLinePrice({
        pricingType: "PER_UNIT_AUTO",
        basePrice: "100.00",
        guestCount: guests,
        guestsPerUnit: 20,
      }).quantity;
    expect(q(1)).toBe(1);
    expect(q(20)).toBe(1);
    expect(q(21)).toBe(2);
    expect(q(45)).toBe(3);
  });

  it("exige guestsPerUnit configurado e positivo", () => {
    for (const guestsPerUnit of [null, 0, -5, 1.5]) {
      expect(() =>
        computeLinePrice({
          pricingType: "PER_UNIT_AUTO",
          basePrice: "100.00",
          guestCount: 40,
          guestsPerUnit,
        })
      ).toThrow(PricingError);
    }
  });
});

describe("bordas de quantidade (PER_UNIT)", () => {
  const base = { pricingType: "PER_UNIT", basePrice: "50.00" } as const;

  it("recusa abaixo do mínimo e acima do máximo", () => {
    expect(() =>
      computeLinePrice({ ...base, quantity: 1, minQty: 2 })
    ).toThrow(/mínima/);
    expect(() =>
      computeLinePrice({ ...base, quantity: 11, maxQty: 10 })
    ).toThrow(/máxima/);
  });

  it("aceita exatamente os limites", () => {
    expect(
      computeLinePrice({ ...base, quantity: 2, minQty: 2, maxQty: 10 }).quantity
    ).toBe(2);
    expect(
      computeLinePrice({ ...base, quantity: 10, minQty: 2, maxQty: 10 }).quantity
    ).toBe(10);
  });

  it("sem limites configurados, aceita qualquer quantidade não negativa", () => {
    expect(computeLinePrice({ ...base, quantity: 0 }).subtotal).toBe("0.00");
    expect(computeLinePrice({ ...base, quantity: 999 }).subtotal).toBe(
      "49950.00"
    );
  });

  it("recusa quantidade fracionária ou negativa", () => {
    expect(() => computeLinePrice({ ...base, quantity: 2.5 })).toThrow(
      PricingError
    );
    expect(() => computeLinePrice({ ...base, quantity: -1 })).toThrow(
      PricingError
    );
  });
});

describe("convidados obrigatórios", () => {
  it.each(["PER_GUEST", "PER_UNIT_AUTO"] as const)(
    "%s falha sem número de convidados",
    (pricingType) => {
      expect(() =>
        computeLinePrice({
          pricingType,
          basePrice: "10.00",
          guestsPerUnit: 20,
          guestCount: null,
        })
      ).toThrow(/convidados/);
    }
  );

  it("FIXED e PER_UNIT não dependem de convidados", () => {
    expect(
      computeLinePrice({ pricingType: "FIXED", basePrice: "10.00" }).subtotal
    ).toBe("10.00");
    expect(
      computeLinePrice({
        pricingType: "PER_UNIT",
        basePrice: "10.00",
        quantity: 2,
      }).subtotal
    ).toBe("20.00");
  });
});

describe("quantityIsEditable", () => {
  it("só PER_UNIT deixa o usuário digitar a quantidade", () => {
    expect(PRICING_TYPES.filter(quantityIsEditable)).toEqual(["PER_UNIT"]);
  });
});

describe("applyAdjustments (RF-V2-10)", () => {
  it("aplica desconto fixo e percentual", () => {
    expect(
      applyAdjustments("1000.00", [
        { kind: "desconto", mode: "fixo", value: "100.00" },
      ]).total
    ).toBe("900.00");
    expect(
      applyAdjustments("1000.00", [
        { kind: "desconto", mode: "percentual", value: "10.00" },
      ]).total
    ).toBe("900.00");
  });

  it("aplica taxa fixa e percentual", () => {
    expect(
      applyAdjustments("1000.00", [
        { kind: "taxa", mode: "fixo", value: "50.00" },
      ]).total
    ).toBe("1050.00");
    expect(
      applyAdjustments("1000.00", [
        { kind: "taxa", mode: "percentual", value: "5.00" },
      ]).total
    ).toBe("1050.00");
  });

  /**
   * Percentuais incidem sobre o subtotal **original**, não em cascata: se a taxa
   * mudasse ao mexer no desconto, a proposta viraria impossível de explicar.
   */
  it("percentuais não compõem em cascata", () => {
    const r = applyAdjustments("1000.00", [
      { kind: "desconto", mode: "percentual", value: "10.00" },
      { kind: "taxa", mode: "percentual", value: "10.00" },
    ]);
    expect(r.discountTotal).toBe("100.00");
    expect(r.feeTotal).toBe("100.00"); // 10% de 1000, não de 900
    expect(r.total).toBe("1000.00");
  });

  it("desconto maior que o subtotal zera o total, nunca fica negativo", () => {
    const r = applyAdjustments("100.00", [
      { kind: "desconto", mode: "fixo", value: "500.00" },
    ]);
    expect(r.total).toBe("0.00");
  });

  it("a taxa incide sobre o que sobrou depois do piso", () => {
    const r = applyAdjustments("100.00", [
      { kind: "desconto", mode: "fixo", value: "500.00" },
      { kind: "taxa", mode: "fixo", value: "30.00" },
    ]);
    expect(r.total).toBe("30.00");
  });

  it("arredonda o percentual para o centavo mais próximo", () => {
    // 33,33% de R$ 10,01 = 3,336333 → 3,34
    const r = applyAdjustments("10.01", [
      { kind: "desconto", mode: "percentual", value: "33.33" },
    ]);
    expect(r.discountTotal).toBe("3.34");
    expect(r.total).toBe("6.67");
  });

  it("recusa percentual acima de 100% e valor negativo", () => {
    expect(() =>
      applyAdjustments("100.00", [
        { kind: "desconto", mode: "percentual", value: "101.00" },
      ])
    ).toThrow(/100%/);
    expect(() =>
      applyAdjustments("100.00", [
        { kind: "taxa", mode: "fixo", value: "-10.00" },
      ])
    ).toThrow(/negativo/);
  });

  it("sem ajustes, o total é o subtotal", () => {
    const r = applyAdjustments("1234.56", []);
    expect(r).toMatchObject({
      subtotal: "1234.56",
      discountTotal: "0.00",
      feeTotal: "0.00",
      total: "1234.56",
      breakdown: [],
    });
  });

  it("detalha quanto cada ajuste moveu", () => {
    const adjustments: Adjustment[] = [
      { kind: "desconto", mode: "percentual", value: "10.00", label: "Fidelidade" },
      { kind: "taxa", mode: "fixo", value: "75.00", label: "Deslocamento" },
    ];
    const r = applyAdjustments("2000.00", adjustments);
    expect(r.breakdown.map((b) => [b.label, b.amount])).toEqual([
      ["Fidelidade", "200.00"],
      ["Deslocamento", "75.00"],
    ]);
  });
});

describe("computeProposalTotals", () => {
  it("soma as linhas e aplica os ajustes por cima", () => {
    const r = computeProposalTotals(
      [
        {
          id: "pkg",
          name: "Pacote Ouro",
          pricingType: "PER_GUEST",
          basePrice: "150.00",
          guestCount: 100,
        },
        {
          id: "garcom",
          name: "Garçom",
          pricingType: "PER_UNIT_AUTO",
          basePrice: "200.00",
          guestCount: 100,
          guestsPerUnit: 20,
        },
        {
          id: "tenda",
          name: "Tenda",
          pricingType: "PER_UNIT",
          basePrice: "400.00",
          quantity: 2,
        },
        { id: "taxa", name: "Deslocamento", pricingType: "FIXED", basePrice: "300.00" },
      ],
      [{ kind: "desconto", mode: "percentual", value: "5.00" }]
    );

    expect(r.lines.map((l) => l.subtotal)).toEqual([
      "15000.00",
      "1000.00", // ceil(100/20) = 5 × 200
      "800.00",
      "300.00",
    ]);
    expect(r.subtotal).toBe("17100.00");
    expect(r.discountTotal).toBe("855.00");
    expect(r.total).toBe("16245.00");
  });

  it("proposta vazia soma zero", () => {
    const r = computeProposalTotals([], []);
    expect(r.subtotal).toBe("0.00");
    expect(r.total).toBe("0.00");
  });

  it("devolve id e nome intactos, para casar com as linhas de quem chamou", () => {
    const r = computeProposalTotals(
      [{ id: "abc", name: "Item", pricingType: "FIXED", basePrice: "1.00" }],
      []
    );
    expect(r.lines[0]).toMatchObject({ id: "abc", name: "Item", quantity: 1 });
  });
});
