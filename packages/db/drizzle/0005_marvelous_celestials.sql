CREATE TABLE "budget_status_log" (
	"id" text PRIMARY KEY NOT NULL,
	"budgetId" text NOT NULL,
	"fromStatus" text NOT NULL,
	"toStatus" text NOT NULL,
	"actorUserId" text,
	"actorName" text NOT NULL,
	"reason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budget_status_log" ADD CONSTRAINT "budget_status_log_budgetId_leads_budgets_id_fk" FOREIGN KEY ("budgetId") REFERENCES "public"."leads_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_status_log" ADD CONSTRAINT "budget_status_log_actorUserId_user_id_fk" FOREIGN KEY ("actorUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_status_log_budget_idx" ON "budget_status_log" USING btree ("budgetId","createdAt");--> statement-breakpoint
-- ============================================================================
-- RF-V2-01 / RNF-V2-06 — migração dos status do MVP para os estados formais.
--
-- Quatro dos cinco valores antigos ('novo', 'em_negociacao', 'aprovado',
-- 'perdido') já são estados formais e ficam intactos. Só 'formalizando' some.
--
-- Ele vira 'em_negociacao', e NÃO 'proposta_enviada': no novo modelo esse estado
-- carrega o invariante de ter revisão ativa e `validUntil` (RF-V2-07/RF-V2-11),
-- que nenhum registro do MVP tem. Migrar para lá criaria linhas que a máquina de
-- estados considera impossíveis — e que o cron de expiração tentaria processar.
-- ============================================================================
-- Gerador UUIDv7 em SQL: o contrato de ids do repo vale dentro da migration
-- também, e aqui não há como chamar o `generateId()` da aplicação. Função
-- temporária (`pg_temp`), que morre com a sessão. Mesma da 0003.
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
-- O log é escrito ANTES do UPDATE, para registrar o estado de origem real.
-- Idempotente pelo NOT EXISTS: reaplicar não duplica evento.
--
-- Note que 'formalizando' fica gravado em `fromStatus` para sempre. É de
-- propósito: o log é histórico e não leva CHECK — restringi-lo ao enum atual
-- faria toda mudança futura de vocabulário reescrever o passado.
INSERT INTO "budget_status_log" ("id", "budgetId", "fromStatus", "toStatus", "actorUserId", "actorName", "reason", "createdAt")
SELECT
  pg_temp.uuidv7_at(now()::timestamp),
  l."id",
  'formalizando',
  'em_negociacao',
  NULL,
  'Sistema (migração v2)',
  'Estado "Formalizando" descontinuado na v2; a negociação volta para a mesa e a proposta pode ser reenviada.',
  now()
FROM "leads_budgets" l
WHERE l."status" = 'formalizando'
  AND NOT EXISTS (
    SELECT 1 FROM "budget_status_log" g
    WHERE g."budgetId" = l."id" AND g."fromStatus" = 'formalizando'
  );--> statement-breakpoint
UPDATE "leads_budgets" SET "status" = 'em_negociacao' WHERE "status" = 'formalizando';--> statement-breakpoint
-- RF-V2-01: o vocabulário passa a ser garantido pelo banco. Até aqui `status`
-- era `text` livre — um UPDATE manual conseguia gravar qualquer coisa.
ALTER TABLE "leads_budgets" ADD CONSTRAINT "leads_budgets_status_check"
  CHECK ("status" IN ('novo','em_negociacao','proposta_enviada','aprovado','fechado','perdido','cancelado','expirado'));--> statement-breakpoint
-- ============================================================================
-- RNF-V2-05 — imutabilidade do log de auditoria.
--
-- A garantia é do banco, não da aplicação: sem endpoint de escrita o log já
-- estaria protegido do tráfego HTTP, mas continuaria editável por psql, pelo
-- Drizzle Studio ou por um bug em qualquer service. A trigger fecha isso para
-- todo mundo, inclusive para o dono do schema.
-- ============================================================================
CREATE OR REPLACE FUNCTION budget_status_log_immutable() RETURNS trigger AS $$
BEGIN
  -- Exceção única: a cascata do `ON DELETE cascade`. O Postgres apaga a linha
  -- pai primeiro e só então dispara a ação referencial, então dentro deste
  -- trigger a negociação já não existe — é o que distingue "apagar o log de uma
  -- negociação viva" (fraude de auditoria, bloqueia) de "a negociação inteira
  -- deixou de existir" (excluir uma organização, legítimo). Sem esta saída,
  -- remover um buffet passaria a ser impossível.
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM "leads_budgets" WHERE "id" = OLD."budgetId"
  ) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'budget_status_log é imutável: registros de auditoria não podem ser alterados nem excluídos (RNF-V2-05)';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER budget_status_log_no_update_or_delete
  BEFORE UPDATE OR DELETE ON "budget_status_log"
  FOR EACH ROW EXECUTE FUNCTION budget_status_log_immutable();