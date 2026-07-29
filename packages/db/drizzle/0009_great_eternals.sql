CREATE TABLE "date_availability" (
	"organizationId" text NOT NULL,
	"date" text NOT NULL,
	"status" text DEFAULT 'disponivel' NOT NULL,
	"note" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "date_availability_organizationId_date_pk" PRIMARY KEY("organizationId","date")
);
--> statement-breakpoint
ALTER TABLE "date_availability" ADD CONSTRAINT "date_availability_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "date_availability" ADD CONSTRAINT "date_availability_status_check"
  CHECK ("status" IN ('disponivel','quase_cheio','indisponivel'));--> statement-breakpoint
-- O formato do texto é parte do contrato: a PK ordena e compara como string, e
-- uma data fora do padrão quebraria a varredura por intervalo do calendário.
ALTER TABLE "date_availability" ADD CONSTRAINT "date_availability_date_check"
  CHECK ("date" ~ '^\d{4}-\d{2}-\d{2}$');
