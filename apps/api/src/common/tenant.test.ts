import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { schema } from "@buffet/db";
import { orgScope, scopedWhere } from "./tenant.js";

const dialect = new PgDialect();
const render = (clause: Parameters<typeof dialect.sqlToQuery>[0]) =>
  dialect.sqlToQuery(clause);

describe("multi-tenant isolation helpers (RNF05)", () => {
  it("orgScope filters by the given organizationId", () => {
    const got = render(orgScope(schema.items, "org-123"));
    const expected = render(eq(schema.items.organizationId, "org-123"));
    expect(got.sql).toBe(expected.sql);
    expect(got.params).toEqual(expected.params);
    expect(got.sql).toContain('"organizationId"');
    expect(got.params).toContain("org-123");
  });

  it("scopedWhere always includes the org filter", () => {
    const { sql, params } = render(scopedWhere(schema.leadsBudgets, "org-1"));
    expect(sql).toContain('"organizationId"');
    expect(params).toContain("org-1");
  });

  it("scopedWhere combines the org filter with extra conditions via AND", () => {
    const { sql, params } = render(
      scopedWhere(
        schema.leadsBudgets,
        "org-1",
        eq(schema.leadsBudgets.status, "novo")
      )
    );
    expect(sql).toContain('"organizationId"');
    expect(sql).toContain('"status"');
    expect(sql).toContain(" and ");
    expect(params).toEqual(expect.arrayContaining(["org-1", "novo"]));
  });
});
