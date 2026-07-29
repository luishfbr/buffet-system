-- Reversão da 0006 (RNF-V2-06). Escrita à mão: o drizzle-kit não gera `down`.
--
-- Aplique em transação única e remova a entrada da 0006 de
-- `drizzle/meta/_journal.json` e de `__drizzle_migrations`:
--   psql "$DATABASE_URL" -1 -f packages/db/drizzle/down/0006_lean_starjammers.down.sql
--
-- Perda de dado assumida: a composição de proposta (linhas e ajustes) só existe
-- nestas tabelas. O que veio do backfill é reconstituível de
-- `leads_budgets.packageId`; o que o usuário montou depois, não. Por isso o
-- aviso abaixo em vez de um DROP silencioso.
DO $$
DECLARE manuais int;
BEGIN
  SELECT count(*) INTO manuais
    FROM "budget_line_items" b
    JOIN "leads_budgets" l ON l."id" = b."budgetId"
   WHERE b."itemId" IS NOT NULL OR b."packageId" IS DISTINCT FROM l."packageId";
  IF manuais > 0 THEN
    RAISE WARNING 'Reversão vai descartar % linha(s) de proposta montadas à mão.', manuais;
  END IF;
END $$;

DROP TABLE IF EXISTS "budget_adjustments";
DROP TABLE IF EXISTS "budget_line_items";

ALTER TABLE "items" DROP CONSTRAINT IF EXISTS "items_pricing_type_check";
ALTER TABLE "items" DROP COLUMN IF EXISTS "guestsPerUnit";
ALTER TABLE "items" DROP COLUMN IF EXISTS "maxQty";
ALTER TABLE "items" DROP COLUMN IF EXISTS "minQty";
ALTER TABLE "items" DROP COLUMN IF EXISTS "pricingType";
