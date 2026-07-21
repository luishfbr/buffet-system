import { and, eq, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Multi-tenant isolation helpers (RNF05).
 *
 * Every operational query MUST be scoped to the active organization. These
 * helpers make that explicit and hard to forget: build the org filter and
 * AND it with any additional conditions.
 */

/** A table shape that carries a direct organizationId column. */
export interface OrgScoped {
  organizationId: PgColumn;
}

/** `where(eq(table.organizationId, orgId))` */
export function orgScope(table: OrgScoped, orgId: string): SQL {
  return eq(table.organizationId, orgId);
}

/** Combine the org scope with extra conditions into a single AND clause. */
export function scopedWhere(
  table: OrgScoped,
  orgId: string,
  ...conditions: Array<SQL | undefined>
): SQL {
  const clause = and(orgScope(table, orgId), ...conditions);
  // `and` only returns undefined when given no defined conditions; orgScope is
  // always defined, so this is safe.
  return clause as SQL;
}
