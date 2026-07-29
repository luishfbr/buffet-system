-- Reversão da 0005 (RNF-V2-06). Escrita à mão: o drizzle-kit não gera `down`.
--
-- ⚠️ Não é rodada automaticamente por nada. Aplique com:
--   psql "$DATABASE_URL" -1 -f packages/db/drizzle/down/0005_marvelous_celestials.down.sql
-- e depois remova a entrada da 0005 de `drizzle/meta/_journal.json` e de
-- `__drizzle_migrations`, senão o Drizzle a considera aplicada.
--
-- O `-1` (transação única) importa: reverter pela metade deixa o banco com CHECK
-- novo e código velho, que é pior que os dois estados inteiros.

-- 1. Solta a trigger antes de qualquer coisa — ela bloqueia o DELETE abaixo.
DROP TRIGGER IF EXISTS budget_status_log_no_update_or_delete ON "budget_status_log";
DROP FUNCTION IF EXISTS budget_status_log_immutable();

-- 2. Solta o CHECK antes de reescrever os status (senão 'formalizando' é recusado).
ALTER TABLE "leads_budgets" DROP CONSTRAINT IF EXISTS "leads_budgets_status_check";

-- 3. Devolve a 'formalizando' as negociações que a migração converteu, e só
--    elas: o log diz exatamente quais foram. Uma negociação que voltou para
--    'em_negociacao' depois, por decisão de um usuário, tem um evento mais
--    recente e não deve ser tocada.
UPDATE "leads_budgets" l
SET "status" = 'formalizando'
WHERE l."status" = 'em_negociacao'
  AND EXISTS (
    SELECT 1 FROM "budget_status_log" g
    WHERE g."budgetId" = l."id"
      AND g."fromStatus" = 'formalizando'
      AND g."createdAt" = (
        SELECT max(g2."createdAt") FROM "budget_status_log" g2 WHERE g2."budgetId" = l."id"
      )
  );

-- 4. Estados que a v2 introduziu não existem no vocabulário do MVP. Quem estiver
--    neles precisa de decisão humana — a reversão para e avisa, em vez de
--    inventar um destino.
DO $$
DECLARE orfaos int;
BEGIN
  SELECT count(*) INTO orfaos FROM "leads_budgets"
   WHERE "status" IN ('proposta_enviada','fechado','cancelado','expirado');
  IF orfaos > 0 THEN
    RAISE EXCEPTION 'Reversão abortada: % negociação(ões) em estado exclusivo da v2. Mova-as para novo/em_negociacao/aprovado/perdido antes de reverter.', orfaos;
  END IF;
END $$;

-- 5. Por último a tabela: se algum passo acima falhar, o log ainda está lá para
--    dizer o que aconteceu.
DROP TABLE IF EXISTS "budget_status_log";
