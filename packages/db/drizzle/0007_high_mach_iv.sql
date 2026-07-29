ALTER TABLE "budget_line_items" DROP CONSTRAINT "budget_line_items_packageId_packages_id_fk";
--> statement-breakpoint
ALTER TABLE "budget_line_items" DROP CONSTRAINT "budget_line_items_itemId_items_id_fk";
--> statement-breakpoint
ALTER TABLE "budget_line_items" ADD CONSTRAINT "budget_line_items_packageId_packages_id_fk" FOREIGN KEY ("packageId") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_line_items" ADD CONSTRAINT "budget_line_items_itemId_items_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;