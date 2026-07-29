import { describe, it, expect } from "vitest";
import { ilike, notInArray, or } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { schema } from "@buffet/db";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { NEGATIVE_LEAD_STATUSES } from "@buffet/shared";
import { scopedWhere } from "../common/tenant.js";
import { assertTransitionAllowed, dayRange } from "./leads.service.js";

describe("dayRange (RF21 conflict window)", () => {
  it("returns the UTC [startOfDay, nextDay) window", () => {
    const { start, end } = dayRange(new Date("2026-09-15T18:30:00.000Z"));
    expect(start.toISOString()).toBe("2026-09-15T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-16T00:00:00.000Z");
  });

  it("brackets any instant within the same day", () => {
    const { start, end } = dayRange(new Date("2026-01-01T23:59:59.000Z"));
    const sameDay = new Date("2026-01-01T00:00:00.000Z");
    const nextDay = new Date("2026-01-02T00:00:00.000Z");
    expect(sameDay >= start && sameDay < end).toBe(true);
    expect(nextDay >= start && nextDay < end).toBe(false);
  });
});

describe("busca no servidor do GET /leads (higiene da Sprint 14)", () => {
  it("monta um OR por nome, telefone e e-mail, sempre escopado na org", () => {
    const dialect = new PgDialect();
    const term = "%marina%";
    const clause = scopedWhere(
      schema.leadsBudgets,
      "org-1",
      or(
        ilike(schema.leadsBudgets.customerName, term),
        ilike(schema.leadsBudgets.customerPhone, term),
        ilike(schema.leadsBudgets.customerEmail, term)
      )
    );
    const { sql, params } = dialect.sqlToQuery(clause!);

    // RNF05: o filtro de organização não pode ficar de fora nem na busca.
    expect(sql).toContain('"organizationId"');
    expect(params).toContain("org-1");
    expect(sql).toContain("ilike");
    expect(sql).toContain(" or ");
    expect(params.filter((p) => p === term)).toHaveLength(3);
  });
});

describe("assertTransitionAllowed (RF-V2-02 / RF-V2-03)", () => {
  it("devolve a regra quando o caminho existe e o papel permite", () => {
    const rule = assertTransitionAllowed("novo", "em_negociacao", "member", null);
    expect(rule.to).toBe("em_negociacao");
  });

  it("recusa um salto que a tabela não prevê", () => {
    expect(() =>
      assertTransitionAllowed("novo", "aprovado", "owner", null)
    ).toThrow(BadRequestException);
  });

  it("recusa qualquer saída de estado terminal, inclusive para o owner", () => {
    for (const from of ["fechado", "perdido", "cancelado", "expirado"] as const) {
      expect(() =>
        assertTransitionAllowed(from, "em_negociacao", "owner", "reabrir")
      ).toThrow(BadRequestException);
    }
  });

  it("bloqueia o member no cancelamento e libera o owner", () => {
    expect(() =>
      assertTransitionAllowed("novo", "cancelado", "member", "duplicado")
    ).toThrow(ForbiddenException);
    expect(
      assertTransitionAllowed("novo", "cancelado", "owner", "duplicado").to
    ).toBe("cancelado");
  });

  it("exige motivo nos caminhos negativos", () => {
    expect(() =>
      assertTransitionAllowed("em_negociacao", "perdido", "member", null)
    ).toThrow(BadRequestException);
    expect(
      assertTransitionAllowed("em_negociacao", "perdido", "member", "sem verba")
        .requiresReason
    ).toBe(true);
  });

  /**
   * O service normaliza com `.trim() || null` antes de chamar — este teste fixa
   * o contrato do outro lado: espaço em branco não é motivo.
   */
  it("não aceita motivo em branco disfarçado de preenchido", () => {
    expect(() =>
      assertTransitionAllowed("em_negociacao", "perdido", "owner", "")
    ).toThrow(BadRequestException);
  });

  it("não exige motivo nos caminhos de avanço", () => {
    expect(
      assertTransitionAllowed("proposta_enviada", "aprovado", "member", null).to
    ).toBe("aprovado");
  });

  it("só o sistema expira, e o sistema não faz mais nada", () => {
    expect(
      assertTransitionAllowed("proposta_enviada", "expirado", "system", null).to
    ).toBe("expirado");
    for (const role of ["member", "owner"] as const) {
      expect(() =>
        assertTransitionAllowed("proposta_enviada", "expirado", role, null)
      ).toThrow(ForbiddenException);
    }
    // O caminho inverso: o cron não pode aprovar nem cancelar nada.
    expect(() =>
      assertTransitionAllowed("proposta_enviada", "aprovado", "system", null)
    ).toThrow(ForbiddenException);
  });
});

describe("filtro de compromissos reais (RF21/RF31 sob os 8 estados)", () => {
  it("exclui perdido, cancelado e expirado — não só perdido", () => {
    const { sql, params } = new PgDialect().sqlToQuery(
      notInArray(schema.leadsBudgets.status, [...NEGATIVE_LEAD_STATUSES])
    );
    expect(sql).toContain("not in");
    expect(params).toEqual(["perdido", "cancelado", "expirado"]);
  });
});
