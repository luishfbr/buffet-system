import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { desc, eq, gte, lt, ne, sql } from "drizzle-orm";
import { schema, type Database, type LeadBudget } from "@buffet/db";
import {
  buildProposalText,
  computeBudgetTotal,
  type LeadStatus,
  type UpdateLeadInput,
} from "@buffet/shared";
import { DB } from "../database/database.module.js";
import { scopedWhere } from "../common/tenant.js";

/** UTC day window `[startOfDay, nextDay)` for a date — used by conflict checks. */
export function dayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/** A lead enriched with its package name and same-day conflict count (RF21). */
export interface LeadDetail extends LeadBudget {
  packageName: string | null;
  conflictCount: number;
}

@Injectable()
export class LeadsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Dynamic listing, optionally filtered by status (RF19). Org-scoped. */
  async list(orgId: string, status?: LeadStatus): Promise<LeadBudget[]> {
    return this.db
      .select()
      .from(schema.leadsBudgets)
      .where(
        scopedWhere(
          schema.leadsBudgets,
          orgId,
          status ? eq(schema.leadsBudgets.status, status) : undefined
        )
      )
      .orderBy(desc(schema.leadsBudgets.createdAt));
  }

  /** A single negotiation with package name and date-conflict count (RF21). */
  async getOne(orgId: string, id: string): Promise<LeadDetail> {
    const lead = await this.getOwnedOrThrow(orgId, id);
    const [pkg] = lead.packageId
      ? await this.db
          .select({ name: schema.packages.name })
          .from(schema.packages)
          .where(
            scopedWhere(
              schema.packages,
              orgId,
              eq(schema.packages.id, lead.packageId)
            )
          )
          .limit(1)
      : [];
    const conflictCount = lead.eventDate
      ? await this.countDateConflicts(orgId, lead.eventDate, lead.id)
      : 0;
    return { ...lead, packageName: pkg?.name ?? null, conflictCount };
  }

  /** Generate the copy-ready proposal text for a negotiation (RF22). */
  async proposalText(orgId: string, id: string): Promise<{ text: string }> {
    const lead = await this.getOwnedOrThrow(orgId, id);
    const [org] = await this.db
      .select({ name: schema.organization.name })
      .from(schema.organization)
      .where(eq(schema.organization.id, orgId))
      .limit(1);
    const [pkg] = lead.packageId
      ? await this.db
          .select({ name: schema.packages.name })
          .from(schema.packages)
          .where(
            scopedWhere(
              schema.packages,
              orgId,
              eq(schema.packages.id, lead.packageId)
            )
          )
          .limit(1)
      : [];
    return {
      text: buildProposalText({
        customerName: lead.customerName,
        organizationName: org?.name ?? null,
        packageName: pkg?.name ?? null,
        eventDate: lead.eventDate,
        guestCount: lead.guestCount,
        totalValue: lead.totalValue,
      }),
    };
  }

  /**
   * Update a negotiation: status transitions (RF19), notes/history (RF20),
   * lost reason, and customer/event edits. Recomputes totalValue when the
   * package or guest count changes. Org-scoped (RNF05).
   */
  async update(
    orgId: string,
    id: string,
    input: UpdateLeadInput
  ): Promise<LeadDetail> {
    const current = await this.getOwnedOrThrow(orgId, id);

    // Resolve the effective package (may change) and validate ownership.
    let packageId = current.packageId;
    let pricePerPerson: string | null = null;
    if (input.packageId !== undefined) {
      packageId = input.packageId || null;
    }
    if (packageId) {
      const [pkg] = await this.db
        .select({ pricePerPerson: schema.packages.pricePerPerson })
        .from(schema.packages)
        .where(
          scopedWhere(schema.packages, orgId, eq(schema.packages.id, packageId))
        )
        .limit(1);
      if (!pkg) {
        throw new NotFoundException("Pacote não encontrado");
      }
      pricePerPerson = pkg.pricePerPerson;
    }

    const guestCount =
      input.guestCount !== undefined ? input.guestCount : current.guestCount;

    // Recompute the total whenever the inputs to it are touched.
    const recompute =
      input.packageId !== undefined || input.guestCount !== undefined;
    const totalValue = recompute
      ? pricePerPerson && guestCount
        ? computeBudgetTotal(pricePerPerson, guestCount)
        : null
      : current.totalValue;

    const eventDate =
      input.eventDate !== undefined
        ? input.eventDate
          ? new Date(input.eventDate)
          : null
        : current.eventDate;

    const [row] = await this.db
      .update(schema.leadsBudgets)
      .set({
        ...(input.customerName !== undefined
          ? { customerName: input.customerName }
          : {}),
        ...(input.customerEmail !== undefined
          ? { customerEmail: input.customerEmail || null }
          : {}),
        ...(input.customerPhone !== undefined
          ? { customerPhone: input.customerPhone }
          : {}),
        ...(input.eventDate !== undefined ? { eventDate } : {}),
        ...(input.guestCount !== undefined ? { guestCount } : {}),
        ...(input.packageId !== undefined ? { packageId } : {}),
        ...(recompute ? { totalValue } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
        // lostReason only makes sense on a "perdido" lead; clear it otherwise.
        ...(input.status !== undefined && input.status !== "perdido"
          ? { lostReason: null }
          : input.lostReason !== undefined
            ? { lostReason: input.lostReason || null }
            : {}),
        updatedAt: new Date(),
      })
      .where(
        scopedWhere(schema.leadsBudgets, orgId, eq(schema.leadsBudgets.id, id))
      )
      .returning();

    return this.getOne(orgId, row!.id);
  }

  /**
   * Count other saved/approved events on the same calendar day (RF21). Lost
   * leads are excluded — they are not real bookings. Never blocks saving.
   */
  private async countDateConflicts(
    orgId: string,
    eventDate: Date,
    excludeId: string
  ): Promise<number> {
    const { start, end } = dayRange(eventDate);
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.leadsBudgets)
      .where(
        scopedWhere(
          schema.leadsBudgets,
          orgId,
          ne(schema.leadsBudgets.id, excludeId),
          ne(schema.leadsBudgets.status, "perdido"),
          gte(schema.leadsBudgets.eventDate, start),
          lt(schema.leadsBudgets.eventDate, end)
        )
      );
    return row?.count ?? 0;
  }

  private async getOwnedOrThrow(
    orgId: string,
    id: string
  ): Promise<LeadBudget> {
    const [row] = await this.db
      .select()
      .from(schema.leadsBudgets)
      .where(
        scopedWhere(schema.leadsBudgets, orgId, eq(schema.leadsBudgets.id, id))
      )
      .limit(1);
    if (!row) throw new NotFoundException("Negociação não encontrada");
    return row;
  }
}
