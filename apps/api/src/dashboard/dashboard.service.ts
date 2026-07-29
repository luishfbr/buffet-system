import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { schema, type Database } from "@buffet/db";
import {
  LEAD_STATUSES,
  type DashboardBadges,
  type DashboardCatalogCounts,
  type DashboardSummary,
  type DashboardUpcomingEvent,
  type LeadStatus,
  type MemberRole,
} from "@buffet/shared";
import { DB } from "../database/database.module.js";
import { scopedWhere } from "../common/tenant.js";
import { notCancelledOrLost } from "../leads/leads.service.js";
import { FinanceService } from "../finance/finance.service.js";

/** Início do dia UTC de hoje — mesma semântica de dia do `dayRange` do RF21. */
function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

const UPCOMING_EVENTS_LIMIT = 5;
const NEW_LEADS_WINDOW_DAYS = 7;

/**
 * Painel operacional (RF29/RF30). Só leitura, e **toda agregação acontece no
 * Postgres** — `count`/`sum` com `filter`, nunca puxando as linhas para somar
 * em Node.
 *
 * RNF04 é aplicado aqui, no service, e não no controller: para `member` o bloco
 * financeiro nem chega a ser consultado, em vez de ser calculado e descartado.
 */
@Injectable()
export class DashboardService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly finance: FinanceService
  ) {}

  async summary(orgId: string, role: MemberRole): Promise<DashboardSummary> {
    const [leads, upcomingEvents, catalog, pagePublished, membersCount] =
      await Promise.all([
        this.leadCounts(orgId),
        this.upcomingEvents(orgId),
        this.catalogCounts(orgId),
        this.hasPageSettings(orgId),
        this.memberCount(orgId),
      ]);

    // RNF04: totalizador de receita é exclusivo do proprietário.
    const finance = role === "owner" ? await this.finance.totals(orgId) : null;

    return {
      leads,
      upcomingEvents,
      catalog,
      pagePublished,
      membersCount,
      finance,
    };
  }

  /**
   * Contadores da navegação (RF29). Endpoint próprio porque o shell do painel
   * envolve todas as páginas — se chamasse o `/summary`, a home rodaria a
   * agregação pesada duas vezes.
   */
  async badges(orgId: string, role: MemberRole): Promise<DashboardBadges> {
    const leads = await this.leadCounts(orgId);
    const overduePayments =
      role === "owner" ? (await this.finance.totals(orgId)).overdueCount : null;
    // Deriva do mesmo agregado do /summary para os dois números nunca divergirem.
    return { newLeads: leads.byStatus.novo, overduePayments };
  }

  /** Funil por status + entradas dos últimos 7 dias, em uma única varredura. */
  private async leadCounts(orgId: string): Promise<DashboardSummary["leads"]> {
    const rows = await this.db
      .select({
        status: schema.leadsBudgets.status,
        count: sql<number>`count(*)::int`,
        recent: sql<number>`count(*) filter (
          where ${schema.leadsBudgets.createdAt} >= now() - ${sql.raw(
            `interval '${NEW_LEADS_WINDOW_DAYS} days'`
          )}
        )::int`,
      })
      .from(schema.leadsBudgets)
      .where(scopedWhere(schema.leadsBudgets, orgId))
      .groupBy(schema.leadsBudgets.status);

    // GROUP BY não emite linha para status sem nenhum lead — preenche com zero,
    // senão a home mostra colunas faltando em vez de "0".
    const byStatus = Object.fromEntries(
      LEAD_STATUSES.map((s) => [s, 0])
    ) as Record<LeadStatus, number>;

    let total = 0;
    let newLast7Days = 0;
    for (const row of rows) {
      if (row.status in byStatus) byStatus[row.status as LeadStatus] = row.count;
      total += row.count;
      newLast7Days += row.recent;
    }

    return { byStatus, total, newLast7Days };
  }

  /**
   * Próximos eventos com o aviso de conflito já resolvido. A window function
   * particiona por dia UTC **antes** do LIMIT, então o flag continua correto
   * mesmo cortando em 5 linhas. `date_trunc('day', ...)` sobre um `timestamp`
   * sem timezone dá o mesmo dia que o `dayRange()` do RF21 — é o que garante
   * que painel e alerta da negociação nunca discordem.
   */
  private async upcomingEvents(
    orgId: string
  ): Promise<DashboardUpcomingEvent[]> {
    const rows = await this.db
      .select({
        id: schema.leadsBudgets.id,
        customerName: schema.leadsBudgets.customerName,
        eventDate: schema.leadsBudgets.eventDate,
        guestCount: schema.leadsBudgets.guestCount,
        status: schema.leadsBudgets.status,
        sameDay: sql<number>`count(*) over (
          partition by date_trunc('day', ${schema.leadsBudgets.eventDate})
        )::int`,
      })
      .from(schema.leadsBudgets)
      .where(
        scopedWhere(
          schema.leadsBudgets,
          orgId,
          // Exatamente a mesma regra da agenda e do alerta de conflito — por
          // isso o helper vem de lá, e não reescrito aqui.
          notCancelledOrLost(),
          gte(schema.leadsBudgets.eventDate, startOfTodayUTC())
        )
      )
      .orderBy(asc(schema.leadsBudgets.eventDate))
      .limit(UPCOMING_EVENTS_LIMIT);

    // `eventDate` é nullable no schema. O `gte` acima já descarta NULL, mas o
    // filtro explícito evita depender de uma invariante que mora no WHERE.
    return rows.flatMap((row) =>
      row.eventDate
        ? [
            {
              id: row.id,
              customerName: row.customerName,
              eventDate: row.eventDate.toISOString(),
              guestCount: row.guestCount,
              status: row.status as LeadStatus,
              hasConflict: row.sameDay > 1,
            },
          ]
        : []
    );
  }

  /** Contagens do catálogo — insumo do checklist de configuração (RF30). */
  private async catalogCounts(orgId: string): Promise<DashboardCatalogCounts> {
    const [itemRows, packageRow] = await Promise.all([
      this.db
        .select({ type: schema.items.type, count: sql<number>`count(*)::int` })
        .from(schema.items)
        .where(scopedWhere(schema.items, orgId))
        .groupBy(schema.items.type),
      this.db
        .select({
          total: sql<number>`count(distinct ${schema.packages.id})::int`,
          withPhotos: sql<number>`count(distinct ${schema.packageImages.packageId})::int`,
        })
        .from(schema.packages)
        // LEFT JOIN: pacote sem foto ainda precisa contar no total.
        .leftJoin(
          schema.packageImages,
          eq(schema.packageImages.packageId, schema.packages.id)
        )
        .where(scopedWhere(schema.packages, orgId)),
    ]);

    const byType = new Map(itemRows.map((r) => [r.type, r.count]));
    return {
      dish: byType.get("dish") ?? 0,
      drink: byType.get("drink") ?? 0,
      service: byType.get("service") ?? 0,
      packages: packageRow[0]?.total ?? 0,
      packagesWithPhotos: packageRow[0]?.withPhotos ?? 0,
    };
  }

  private async hasPageSettings(orgId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: schema.orgPublicSettings.organizationId })
      .from(schema.orgPublicSettings)
      .where(eq(schema.orgPublicSettings.organizationId, orgId))
      .limit(1);
    return row !== undefined;
  }

  private async memberCount(orgId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.member)
      .where(and(eq(schema.member.organizationId, orgId)));
    return row?.count ?? 0;
  }
}
