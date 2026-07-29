-- Reversão da 0007 (RNF-V2-06): volta as FKs de catálogo para NO ACTION.
--
-- ⚠️ Com isto, apagar uma organização volta a falhar quando houver proposta em
-- elaboração referenciando itens ou pacotes dela. Só reverta junto com a 0006.
ALTER TABLE "budget_line_items" DROP CONSTRAINT IF EXISTS "budget_line_items_packageId_packages_id_fk";
ALTER TABLE "budget_line_items" DROP CONSTRAINT IF EXISTS "budget_line_items_itemId_items_id_fk";
ALTER TABLE "budget_line_items" ADD CONSTRAINT "budget_line_items_packageId_packages_id_fk"
  FOREIGN KEY ("packageId") REFERENCES "public"."packages"("id");
ALTER TABLE "budget_line_items" ADD CONSTRAINT "budget_line_items_itemId_items_id_fk"
  FOREIGN KEY ("itemId") REFERENCES "public"."items"("id");
