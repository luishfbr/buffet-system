-- Reversão da 0008 (RNF-V2-06).
-- Perda de dado assumida: revisões e snapshots só existem aqui. `validUntil`
-- é reconstituível da revisão ativa — que também some. Reverta ciente disso.
DROP INDEX IF EXISTS "leads_valid_until_idx";
DROP TABLE IF EXISTS "budget_proposal_items";
DROP TABLE IF EXISTS "budget_revisions";
DROP TABLE IF EXISTS "org_settings";
ALTER TABLE "leads_budgets" DROP COLUMN IF EXISTS "validUntil";
