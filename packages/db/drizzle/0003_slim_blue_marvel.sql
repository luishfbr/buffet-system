CREATE TABLE "lead_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"budgetId" text NOT NULL,
	"authorUserId" text,
	"authorName" text NOT NULL,
	"body" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_budgetId_leads_budgets_id_fk" FOREIGN KEY ("budgetId") REFERENCES "public"."leads_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_authorUserId_user_id_fk" FOREIGN KEY ("authorUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_notes_budget_idx" ON "lead_notes" USING btree ("budgetId","createdAt");--> statement-breakpoint
-- RF35 — BACKFILL do histórico escrito sob o RF20 (coluna `leads_budgets.notes`).
-- Sem isto, ativar a timeline sumiria da tela com tudo o que já foi anotado.
-- A coluna `notes` é MANTIDA como legado: dropá-la é risco puro, sem ganho.
--
-- Gerador UUIDv7 em SQL: o contrato do repo exige UUIDv7 em todo id, e aqui não
-- há como chamar o `generateId()` da aplicação. Função temporária (`pg_temp`),
-- que morre junto com a sessão da migration.
CREATE OR REPLACE FUNCTION pg_temp.uuidv7_at(ts timestamp) RETURNS text AS $$
  SELECT regexp_replace(
    encode(
      set_byte(
        set_byte(u, 6, (get_byte(u, 6) & 15) | 112),   -- versão 7
        8, (get_byte(u, 8) & 63) | 128),               -- variante RFC 4122
      'hex'),
    '^(.{8})(.{4})(.{4})(.{4})(.{12})$', '\1-\2-\3-\4-\5')
  FROM (
    SELECT overlay(uuid_send(gen_random_uuid())
             placing substring(int8send((extract(epoch from ts) * 1000)::bigint) from 3 for 6)
             from 1 for 6) AS u
  ) s;
$$ LANGUAGE sql VOLATILE;--> statement-breakpoint
-- Idempotente: o NOT EXISTS impede duplicar se a migration for reaplicada.
INSERT INTO "lead_notes" ("id", "budgetId", "authorUserId", "authorName", "body", "createdAt")
SELECT
  pg_temp.uuidv7_at(l."updatedAt"),
  l."id",
  NULL,
  'Importado do histórico anterior',
  l."notes",
  l."updatedAt"
FROM "leads_budgets" l
WHERE l."notes" IS NOT NULL
  AND btrim(l."notes") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "lead_notes" n WHERE n."budgetId" = l."id"
  );