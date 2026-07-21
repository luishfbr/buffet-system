import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { schema, type Database } from "@buffet/db";
import { computeBudgetTotal, type CreatePublicLeadInput } from "@buffet/shared";
import { DB } from "../database/database.module.js";

@Injectable()
export class PublicService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Public org info + active packages for the onboarding page (RF17). */
  async getOrgBySlug(slug: string) {
    const [org] = await this.db
      .select({
        id: schema.organization.id,
        name: schema.organization.name,
        slug: schema.organization.slug,
      })
      .from(schema.organization)
      .where(eq(schema.organization.slug, slug))
      .limit(1);
    if (!org) throw new NotFoundException("Buffet não encontrado");

    const packages = await this.db
      .select({
        id: schema.packages.id,
        name: schema.packages.name,
        description: schema.packages.description,
        pricePerPerson: schema.packages.pricePerPerson,
      })
      .from(schema.packages)
      .where(
        and(
          eq(schema.packages.organizationId, org.id),
          eq(schema.packages.isActive, true)
        )
      );

    return { ...org, packages };
  }

  /** Capture a pre-budget from the public form (RF18). */
  async createLead(input: CreatePublicLeadInput): Promise<{ id: string }> {
    // Honeypot: a real user never fills this (RNF06).
    if (input.website) throw new BadRequestException("Requisição inválida");

    const [org] = await this.db
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .where(eq(schema.organization.slug, input.slug))
      .limit(1);
    if (!org) throw new NotFoundException("Buffet não encontrado");

    // Resolve the chosen package (must belong to the org and be active).
    let pricePerPerson: string | null = null;
    let packageId: string | null = null;
    if (input.packageId) {
      const [pkg] = await this.db
        .select({
          id: schema.packages.id,
          pricePerPerson: schema.packages.pricePerPerson,
        })
        .from(schema.packages)
        .where(
          and(
            eq(schema.packages.id, input.packageId),
            eq(schema.packages.organizationId, org.id),
            eq(schema.packages.isActive, true)
          )
        )
        .limit(1);
      if (!pkg) throw new BadRequestException("Pacote inválido");
      packageId = pkg.id;
      pricePerPerson = pkg.pricePerPerson;
    }

    // Server-authoritative estimate: pricePerPerson × guestCount.
    const totalValue =
      pricePerPerson && input.guestCount
        ? computeBudgetTotal(pricePerPerson, input.guestCount)
        : null;

    const [lead] = await this.db
      .insert(schema.leadsBudgets)
      .values({
        organizationId: org.id,
        customerName: input.customerName,
        customerEmail: input.customerEmail || null,
        customerPhone: input.customerPhone,
        eventDate: input.eventDate ? new Date(input.eventDate) : null,
        guestCount: input.guestCount ?? null,
        packageId,
        totalValue,
        status: "novo",
      })
      .returning({ id: schema.leadsBudgets.id });

    return { id: lead!.id };
  }
}
