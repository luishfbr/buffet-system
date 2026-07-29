CREATE TABLE "org_public_settings" (
	"organizationId" text PRIMARY KEY NOT NULL,
	"template" text DEFAULT 'vitrine' NOT NULL,
	"theme" text DEFAULT 'light' NOT NULL,
	"brandColor" text DEFAULT 'ambar' NOT NULL,
	"logoUrl" text,
	"coverUrl" text,
	"headline" text,
	"subheadline" text,
	"about" text,
	"ctaLabel" text,
	"showPrices" boolean DEFAULT true NOT NULL,
	"whatsapp" text,
	"phone" text,
	"email" text,
	"instagram" text,
	"city" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_images" (
	"id" text PRIMARY KEY NOT NULL,
	"packageId" text NOT NULL,
	"url" text NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "sortOrder" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "isFeatured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "org_public_settings" ADD CONSTRAINT "org_public_settings_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_images" ADD CONSTRAINT "package_images_packageId_packages_id_fk" FOREIGN KEY ("packageId") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "package_images_pkg_idx" ON "package_images" USING btree ("packageId");