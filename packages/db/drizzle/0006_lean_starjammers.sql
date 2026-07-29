CREATE TABLE "budget_adjustments" (
	"id" text PRIMARY KEY NOT NULL,
	"budgetId" text NOT NULL,
	"kind" text NOT NULL,
	"mode" text NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"label" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"budgetId" text NOT NULL,
	"packageId" text,
	"itemId" text,
	"quantity" integer,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "pricingType" text DEFAULT 'FIXED' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "minQty" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "maxQty" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "guestsPerUnit" integer;--> statement-breakpoint
ALTER TABLE "budget_adjustments" ADD CONSTRAINT "budget_adjustments_budgetId_leads_budgets_id_fk" FOREIGN KEY ("budgetId") REFERENCES "public"."leads_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_line_items" ADD CONSTRAINT "budget_line_items_budgetId_leads_budgets_id_fk" FOREIGN KEY ("budgetId") REFERENCES "public"."leads_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_line_items" ADD CONSTRAINT "budget_line_items_packageId_packages_id_fk" FOREIGN KEY ("packageId") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_line_items" ADD CONSTRAINT "budget_line_items_itemId_items_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_adjustments_budget_idx" ON "budget_adjustments" USING btree ("budgetId","sortOrder");--> statement-breakpoint
CREATE INDEX "budget_lines_budget_idx" ON "budget_line_items" USING btree ("budgetId","sortOrder");--> statement-breakpoint
-- RF-V2-09/RF-V2-10: o vocabulário passa a ser garantido pelo banco, como o
-- `status` da 0005. `text` livre aqui deixaria o motor de cálculo receber um
-- tipo que ele não sabe tratar.
ALTER TABLE "items" ADD CONSTRAINT "items_pricing_type_check"
  CHECK ("pricingType" IN ('FIXED','PER_GUEST','PER_UNIT','PER_UNIT_AUTO'));--> statement-breakpoint
ALTER TABLE "budget_adjustments" ADD CONSTRAINT "budget_adjustments_kind_check"
  CHECK ("kind" IN ('desconto','taxa'));--> statement-breakpoint
ALTER TABLE "budget_adjustments" ADD CONSTRAINT "budget_adjustments_mode_check"
  CHECK ("mode" IN ('fixo','percentual'));--> statement-breakpoint
-- Valor do ajuste é sempre positivo: o sinal vem do `kind`, e um desconto
-- negativo seria uma taxa disfarçada que nenhuma tela saberia exibir.
ALTER TABLE "budget_adjustments" ADD CONSTRAINT "budget_adjustments_value_check"
  CHECK ("value" >= 0);--> statement-breakpoint
-- Uma linha é OU um pacote OU um item avulso — nunca ambos, nunca nenhum.
ALTER TABLE "budget_line_items" ADD CONSTRAINT "budget_line_items_target_check"
  CHECK (("packageId" IS NOT NULL) <> ("itemId" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "budget_line_items" ADD CONSTRAINT "budget_line_items_quantity_check"
  CHECK ("quantity" IS NULL OR "quantity" >= 0);--> statement-breakpoint
-- ============================================================================
-- BACKFILL — negociações que já têm pacote entram no compositor com ele.
--
-- Sem isto, toda negociação viva abriria a aba "Proposta" vazia, como se o
-- pacote escolhido no formulário público nunca tivesse existido. Mesmo espírito
-- do backfill de `lead_notes` na 0003, inclusive o UUIDv7 em SQL: o contrato de
-- ids vale dentro da migration.
-- ============================================================================
CREATE OR REPLACE FUNCTION pg_temp.uuidv7_at(ts timestamp) RETURNS text AS $$
  SELECT regexp_replace(
    encode(
      set_byte(
        set_byte(u, 6, (get_byte(u, 6) & 15) | 112),
        8, (get_byte(u, 8) & 63) | 128),
      'hex'),
    '^(.{8})(.{4})(.{4})(.{4})(.{12})$', '\1-\2-\3-\4-\5')
  FROM (
    SELECT overlay(uuid_send(gen_random_uuid())
             placing substring(int8send((extract(epoch from ts) * 1000)::bigint) from 3 for 6)
             from 1 for 6) AS u
  ) s;
$$ LANGUAGE sql VOLATILE;--> statement-breakpoint
INSERT INTO "budget_line_items" ("id", "budgetId", "packageId", "itemId", "quantity", "sortOrder", "createdAt")
SELECT
  pg_temp.uuidv7_at(l."createdAt"),
  l."id",
  l."packageId",
  NULL,
  NULL,
  0,
  l."createdAt"
FROM "leads_budgets" l
WHERE l."packageId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "budget_line_items" b WHERE b."budgetId" = l."id"
  );
