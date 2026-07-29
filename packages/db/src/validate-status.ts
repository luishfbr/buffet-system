import { Pool } from "pg";
import { LEAD_STATUSES } from "@buffet/shared";

/**
 * RNF-V2-06 — validação pós-migração dos estados de negociação.
 *
 * A migration 0005 converte o vocabulário de `leads_budgets.status` e instala o
 * CHECK. Este script confirma que a conversão fechou: nenhum status nulo, nenhum
 * fora do enum, nenhum `formalizando` sobrando, e as travas de integridade
 * (CHECK + trigger de imutabilidade) realmente no lugar.
 *
 * Rode **depois** de `pnpm db:migrate`:
 *   pnpm --filter @buffet/db build && pnpm --filter @buffet/db validate:status
 *
 * Sai com código 1 em qualquer falha — serve para portão de deploy.
 */

/**
 * O vocabulário vem de `@buffet/shared`, **não** copiado à mão: um script cujo
 * trabalho é detectar divergência não pode ser mais uma cópia que diverge.
 */
const VALID_STATUSES = LEAD_STATUSES;

interface Check {
  label: string;
  ok: boolean;
  detail?: string;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL não definida.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const checks: Check[] = [];

  try {
    const { rows: invalid } = await pool.query<{
      status: string | null;
      total: string;
    }>(
      `SELECT "status", count(*)::text AS total
         FROM "leads_budgets"
        WHERE "status" IS NULL OR NOT ("status" = ANY($1::text[]))
        GROUP BY "status"`,
      [VALID_STATUSES]
    );
    checks.push({
      label: "Todo status está no vocabulário da v2",
      ok: invalid.length === 0,
      detail: invalid
        .map((r) => `${r.status ?? "NULL"} (${r.total})`)
        .join(", "),
    });

    const { rows: legacy } = await pool.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM "leads_budgets" WHERE "status" = 'formalizando'`
    );
    checks.push({
      label: "Nenhum 'formalizando' remanescente",
      ok: legacy[0]?.total === "0",
      detail: `${legacy[0]?.total ?? "?"} registro(s)`,
    });

    const { rows: constraint } = await pool.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM pg_constraint
        WHERE conname = 'leads_budgets_status_check'`
    );
    checks.push({
      label: "CHECK leads_budgets_status_check instalado",
      ok: constraint[0]?.total === "1",
    });

    const { rows: trigger } = await pool.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM pg_trigger
        WHERE tgname = 'budget_status_log_no_update_or_delete' AND NOT tgisinternal`
    );
    checks.push({
      label: "Trigger de imutabilidade do log instalada (RNF-V2-05)",
      ok: trigger[0]?.total === "1",
    });

    // Prova viva: tenta editar o log e espera a exceção. Uma trigger existente
    // mas quebrada passaria na checagem de metadados acima.
    let blocked = false;
    try {
      await pool.query("BEGIN");
      // Uma linha só: a trigger aborta na primeira de qualquer jeito, e se ela
      // estiver faltando o estrago fica limitado ao que o ROLLBACK desfaz.
      await pool.query(
        `UPDATE "budget_status_log" SET "reason" = 'tampering'
          WHERE "id" = (SELECT "id" FROM "budget_status_log" LIMIT 1)`
      );
    } catch {
      blocked = true;
    } finally {
      await pool.query("ROLLBACK");
    }
    const { rows: logCount } = await pool.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM "budget_status_log"`
    );
    const hasRows = logCount[0]?.total !== "0";
    checks.push({
      label: "UPDATE no log é recusado pelo banco",
      // Sem linhas o UPDATE não dispara trigger de linha e não prova nada.
      ok: hasRows ? blocked : true,
      detail: hasRows ? undefined : "log vazio — nada a testar",
    });

    const { rows: byStatus } = await pool.query<{
      status: string;
      total: string;
    }>(
      `SELECT "status", count(*)::text AS total FROM "leads_budgets"
        GROUP BY "status" ORDER BY "status"`
    );

    for (const check of checks) {
      const mark = check.ok ? "✓" : "✗";
      console.log(
        `${mark} ${check.label}${check.detail ? ` — ${check.detail}` : ""}`
      );
    }
    console.log("\nDistribuição atual:");
    for (const row of byStatus) console.log(`  ${row.status}: ${row.total}`);

    const failed = checks.filter((c) => !c.ok);
    if (failed.length > 0) {
      console.error(`\n${failed.length} verificação(ões) falharam.`);
      process.exit(1);
    }
    console.log("\nMigração de status validada (RNF-V2-06).");
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
