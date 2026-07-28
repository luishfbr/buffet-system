import { describe, it, expect } from "vitest";
import { ilike, or } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { schema } from "@buffet/db";
import { scopedWhere } from "../common/tenant.js";
import { dayRange } from "./leads.service.js";

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
