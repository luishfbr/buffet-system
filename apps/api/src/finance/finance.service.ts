import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import {
  schema,
  type Database,
  type FinancialPayment,
  type LeadBudget,
} from "@buffet/db";
import {
  sumMoney,
  type CreateScheduleInput,
  type PayInstallmentInput,
} from "@buffet/shared";
import { DB } from "../database/database.module.js";
import { scopedWhere } from "../common/tenant.js";

/** A pending installment enriched with its customer name for the dashboard. */
export interface UpcomingPayment {
  id: string;
  budgetId: string;
  customerName: string;
  dueDate: Date;
  amount: string;
  status: string;
}

export interface FinanceSummary {
  receivable: string;
  received: string;
  pending: UpcomingPayment[];
}

/**
 * Financial module (RF23/RF24). `financial_payments` has no organizationId, so
 * EVERY query is isolated by joining `leads_budgets` and filtering the org
 * (RNF05). All routes are owner-only (enforced at the controller).
 */
@Injectable()
export class FinanceService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Installments of a lead, ordered by due date. Org-scoped via the lead. */
  async listForLead(
    orgId: string,
    budgetId: string
  ): Promise<FinancialPayment[]> {
    await this.getLeadOwnedOrThrow(orgId, budgetId);
    return this.db
      .select()
      .from(schema.financialPayments)
      .where(eq(schema.financialPayments.budgetId, budgetId))
      .orderBy(asc(schema.financialPayments.dueDate));
  }

  /**
   * Generate the payment schedule for an approved negotiation (RF23). Requires
   * the lead to be approved and to have no existing schedule; when the lead has
   * a total, the installments must sum to it exactly.
   */
  async createSchedule(
    orgId: string,
    budgetId: string,
    input: CreateScheduleInput
  ): Promise<FinancialPayment[]> {
    const lead = await this.getLeadOwnedOrThrow(orgId, budgetId);
    if (lead.status !== "aprovado") {
      throw new BadRequestException(
        "Aprove a negociação antes de gerar o cronograma de pagamentos"
      );
    }

    const [existing] = await this.db
      .select({ id: schema.financialPayments.id })
      .from(schema.financialPayments)
      .where(eq(schema.financialPayments.budgetId, budgetId))
      .limit(1);
    if (existing) {
      throw new ConflictException(
        "Esta negociação já possui um cronograma de pagamentos"
      );
    }

    if (lead.totalValue) {
      const scheduled = sumMoney(input.installments.map((i) => i.amount));
      if (scheduled !== lead.totalValue) {
        throw new BadRequestException(
          "A soma das parcelas deve ser igual ao valor total da negociação"
        );
      }
    }

    return this.db
      .insert(schema.financialPayments)
      .values(
        input.installments.map((i) => ({
          budgetId,
          dueDate: new Date(i.dueDate),
          amount: i.amount,
          status: "pendente",
        }))
      )
      .returning();
  }

  /** Settle an installment: mark paid, record method + receipt link (RF24). */
  async pay(
    orgId: string,
    paymentId: string,
    input: PayInstallmentInput
  ): Promise<FinancialPayment> {
    const payment = await this.getPaymentOwnedOrThrow(orgId, paymentId);
    if (payment.status === "pago") {
      throw new BadRequestException("Parcela já está paga");
    }
    const [row] = await this.db
      .update(schema.financialPayments)
      .set({
        status: "pago",
        paymentMethod: input.paymentMethod,
        paidAt: new Date(),
        receiptUrl: input.receiptUrl || null,
      })
      .where(eq(schema.financialPayments.id, paymentId))
      .returning();
    return row!;
  }

  /** Remove a pending installment (owner-only). Paid ones cannot be deleted. */
  async remove(orgId: string, paymentId: string): Promise<void> {
    const payment = await this.getPaymentOwnedOrThrow(orgId, paymentId);
    if (payment.status === "pago") {
      throw new ConflictException("Não é possível excluir uma parcela paga");
    }
    await this.db
      .delete(schema.financialPayments)
      .where(eq(schema.financialPayments.id, paymentId));
  }

  /**
   * Owner-only billing totals (RNF04): amount receivable, amount already
   * received, and the pending installments across the org. Isolated by join.
   */
  async summary(orgId: string): Promise<FinanceSummary> {
    const rows = await this.db
      .select({
        id: schema.financialPayments.id,
        budgetId: schema.financialPayments.budgetId,
        customerName: schema.leadsBudgets.customerName,
        dueDate: schema.financialPayments.dueDate,
        amount: schema.financialPayments.amount,
        status: schema.financialPayments.status,
      })
      .from(schema.financialPayments)
      .innerJoin(
        schema.leadsBudgets,
        eq(schema.financialPayments.budgetId, schema.leadsBudgets.id)
      )
      .where(eq(schema.leadsBudgets.organizationId, orgId))
      .orderBy(asc(schema.financialPayments.dueDate));

    const receivable = sumMoney(
      rows.filter((r) => r.status !== "pago").map((r) => r.amount)
    );
    const received = sumMoney(
      rows.filter((r) => r.status === "pago").map((r) => r.amount)
    );
    const pending = rows.filter((r) => r.status !== "pago");

    return { receivable, received, pending };
  }

  private async getLeadOwnedOrThrow(
    orgId: string,
    budgetId: string
  ): Promise<LeadBudget> {
    const [row] = await this.db
      .select()
      .from(schema.leadsBudgets)
      .where(
        scopedWhere(
          schema.leadsBudgets,
          orgId,
          eq(schema.leadsBudgets.id, budgetId)
        )
      )
      .limit(1);
    if (!row) throw new NotFoundException("Negociação não encontrada");
    return row;
  }

  /** Fetch a payment only if its parent lead belongs to the org (RNF05 join). */
  private async getPaymentOwnedOrThrow(
    orgId: string,
    paymentId: string
  ): Promise<FinancialPayment> {
    const [row] = await this.db
      .select({ payment: schema.financialPayments })
      .from(schema.financialPayments)
      .innerJoin(
        schema.leadsBudgets,
        eq(schema.financialPayments.budgetId, schema.leadsBudgets.id)
      )
      .where(
        and(
          eq(schema.financialPayments.id, paymentId),
          eq(schema.leadsBudgets.organizationId, orgId)
        )
      )
      .limit(1);
    if (!row) throw new NotFoundException("Parcela não encontrada");
    return row.payment;
  }
}
