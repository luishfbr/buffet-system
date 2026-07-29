import { describe, expect, it } from "vitest";
import { DATE_AVAILABILITY_STATUSES } from "@buffet/shared";
import {
  AVAILABILITY_STYLE,
  availabilityIndex,
  availabilityOf,
} from "./availability";

describe("availabilityIndex / availabilityOf (RF-V2-13)", () => {
  /**
   * A API só devolve as datas configuradas; quem consulta pergunta "como está o
   * dia X" e não deveria precisar saber dessa economia.
   */
  it("preenche o padrão para datas sem linha", () => {
    const index = availabilityIndex([
      { date: "2026-08-10", status: "indisponivel" },
    ]);
    expect(availabilityOf(index, "2026-08-10")).toBe("indisponivel");
    expect(availabilityOf(index, "2026-08-11")).toBe("disponivel");
  });

  it("lista vazia deixa tudo disponível", () => {
    const index = availabilityIndex([]);
    expect(availabilityOf(index, "2026-01-01")).toBe("disponivel");
  });
});

describe("AVAILABILITY_STYLE", () => {
  it("cobre os três status", () => {
    for (const s of DATE_AVAILABILITY_STATUSES) {
      expect(AVAILABILITY_STYLE[s]).toBeDefined();
    }
  });

  /**
   * A cor aqui é semáforo, não identidade: usar `--brand` faria "quase cheio"
   * parecer destaque em vez de aviso.
   */
  it("não reaproveita o âmbar da marca", () => {
    for (const s of DATE_AVAILABILITY_STATUSES) {
      const { dot, ring } = AVAILABILITY_STYLE[s];
      expect(dot).not.toContain("brand");
      expect(ring).not.toContain("brand");
    }
  });
});
