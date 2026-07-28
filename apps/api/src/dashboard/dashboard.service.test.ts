import { describe, it, expect, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import type { Database } from "@buffet/db";
import type { DashboardFinance } from "@buffet/shared";
import type { FinanceService } from "../finance/finance.service.js";
import { DashboardService } from "./dashboard.service.js";

const dialect = new PgDialect();

/**
 * Mock encadeável do Drizzle: cada método devolve a si mesmo, a cláusula de
 * `where` é capturada e o objeto é "thenable", então `await` na query resolve
 * para as linhas configuradas. Serve para inspecionar o SQL montado sem banco.
 */
function makeDbSpy(rowsByCall: Record<string, unknown>[][] = []) {
  const wheres: SQL[] = [];
  let callIndex = 0;

  const db = {
    select: () => {
      const rows = rowsByCall[callIndex++] ?? [];
      const chain: Record<string, unknown> = {
        from: () => chain,
        leftJoin: () => chain,
        innerJoin: () => chain,
        groupBy: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        where: (clause: SQL) => {
          wheres.push(clause);
          return chain;
        },
        then: (resolve: (value: unknown) => unknown) => resolve(rows),
      };
      return chain;
    },
  } as unknown as Database;

  return { db, wheres };
}

function makeFinanceSpy() {
  const totals = vi
    .fn<(orgId: string) => Promise<DashboardFinance>>()
    .mockResolvedValue({
      receivable: "0.00",
      received: "0.00",
      overdueCount: 0,
      nextDue: [],
    });
  return { finance: { totals } as unknown as FinanceService, totals };
}

describe("DashboardService", () => {
  it("escopa toda query pelo organizationId (RNF05)", async () => {
    const { db, wheres } = makeDbSpy();
    const { finance } = makeFinanceSpy();

    await new DashboardService(db, finance).summary("org-1", "owner");

    // Cada bloco do painel (funil, eventos, catálogo x2, página, membros).
    expect(wheres.length).toBeGreaterThanOrEqual(6);
    for (const clause of wheres) {
      const { sql, params } = dialect.sqlToQuery(clause);
      expect(sql).toContain('"organizationId"');
      expect(params).toContain("org-1");
    }
  });

  it("não consulta o financeiro para member e devolve finance null (RNF04)", async () => {
    const { db } = makeDbSpy();
    const { finance, totals } = makeFinanceSpy();

    const summary = await new DashboardService(db, finance).summary(
      "org-1",
      "member"
    );

    expect(summary.finance).toBeNull();
    // Não basta esconder na tela: o total nem chega a ser calculado.
    expect(totals).not.toHaveBeenCalled();
  });

  it("consulta o financeiro para owner", async () => {
    const { db } = makeDbSpy();
    const { finance, totals } = makeFinanceSpy();

    const summary = await new DashboardService(db, finance).summary(
      "org-1",
      "owner"
    );

    expect(totals).toHaveBeenCalledWith("org-1");
    expect(summary.finance).not.toBeNull();
  });

  it("preenche com zero os status sem nenhum lead (GROUP BY não emite linha)", async () => {
    // 1ª query do summary é a do funil; as demais ficam vazias.
    const { db } = makeDbSpy([[{ status: "novo", count: 3, recent: 2 }]]);
    const { finance } = makeFinanceSpy();

    const summary = await new DashboardService(db, finance).summary(
      "org-1",
      "owner"
    );

    expect(summary.leads.byStatus.novo).toBe(3);
    expect(summary.leads.byStatus.aprovado).toBe(0);
    expect(summary.leads.byStatus.perdido).toBe(0);
    expect(summary.leads.newLast7Days).toBe(2);
  });

  it("omite o contador de parcelas vencidas no badge do member (RNF04)", async () => {
    const { db } = makeDbSpy();
    const { finance, totals } = makeFinanceSpy();

    const badges = await new DashboardService(db, finance).badges(
      "org-1",
      "member"
    );

    expect(badges.overduePayments).toBeNull();
    expect(totals).not.toHaveBeenCalled();
  });
});
