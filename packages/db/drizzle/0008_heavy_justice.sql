CREATE TABLE "budget_proposal_items" (
	"id" text PRIMARY KEY NOT NULL,
	"revisionId" text NOT NULL,
	"packageId" text,
	"itemId" text,
	"name" text NOT NULL,
	"pricingType" text NOT NULL,
	"basePrice" numeric(10, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"budgetId" text NOT NULL,
	"revisionNumber" integer NOT NULL,
	"validUntil" timestamp NOT NULL,
	"totalValue" numeric(12, 2) NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"adjustments" text,
	"authorUserId" text,
	"authorName" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_settings" (
	"organizationId" text PRIMARY KEY NOT NULL,
	"proposalValidityDays" integer DEFAULT 7 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads_budgets" ADD COLUMN "validUntil" timestamp;--> statement-breakpoint
ALTER TABLE "budget_proposal_items" ADD CONSTRAINT "budget_proposal_items_revisionId_budget_revisions_id_fk" FOREIGN KEY ("revisionId") REFERENCES "public"."budget_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_proposal_items" ADD CONSTRAINT "budget_proposal_items_packageId_packages_id_fk" FOREIGN KEY ("packageId") REFERENCES "public"."packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_proposal_items" ADD CONSTRAINT "budget_proposal_items_itemId_items_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_revisions" ADD CONSTRAINT "budget_revisions_budgetId_leads_budgets_id_fk" FOREIGN KEY ("budgetId") REFERENCES "public"."leads_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_revisions" ADD CONSTRAINT "budget_revisions_authorUserId_user_id_fk" FOREIGN KEY ("authorUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_proposal_items_revision_idx" ON "budget_proposal_items" USING btree ("revisionId","sortOrder");--> statement-breakpoint
CREATE INDEX "budget_revisions_budget_idx" ON "budget_revisions" USING btree ("budgetId","revisionNumber");--> statement-breakpoint
-- RF-V2-07: toda org existente ganha a validade padrão. Idempotente.
INSERT INTO "org_settings" ("organizationId", "proposalValidityDays")
SELECT o."id", 7 FROM "organization" o
WHERE NOT EXISTS (SELECT 1 FROM "org_settings" s WHERE s."organizationId" = o."id");--> statement-breakpoint
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_validity_check"
  CHECK ("proposalValidityDays" BETWEEN 1 AND 30);--> statement-breakpoint
-- Índice parcial para o cron de expiração (RF-V2-08): a varredura é sempre
-- "proposta enviada e vencida", e um índice sobre a tabela inteira desperdiçaria
-- espaço com as negociações que nunca serão candidatas.
CREATE INDEX "leads_valid_until_idx" ON "leads_budgets" ("validUntil")
  WHERE "status" = 'proposta_enviada';--> statement-breakpoint
-- Uma revisão por número, por negociação: a numeração sequencial é o que
-- identifica "v2" para o cliente, e duplicá-la tornaria o histórico ambíguo.
CREATE UNIQUE INDEX "budget_revisions_number_unq" ON "budget_revisions" ("budgetId","revisionNumber");
