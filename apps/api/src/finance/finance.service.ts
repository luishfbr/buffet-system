import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import {
  schema,
  type Database,
  type FinancialPayment,
  type LeadBudget,
} from "@buffet/db";
import {
  sumMoney,
  type CreateScheduleInput,
  type DashboardFinance,
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

/** Quantas parcelas a vencer o painel mostra (RF29). */
const DASHBOARD_NEXT_DUE_LIMIT = 5;

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
   *
   * Os totais vêm de `totals()` — o mesmo agregado que alimenta o painel
   * (RF29). Se cada endpoint somasse por conta própria, um dia divergiriam.
   */
  async summary(orgId: string): Promise<FinanceSummary> {
    const [{ receivable, received }, pending] = await Promise.all([
      this.totals(orgId),
      this.pendingPayments(orgId),
    ]);
    return { receivable, received, pending };
  }

  /**
   * Agregado financeiro da organização, somado **no Postgres** (RF29/RNF04).
   *
   * `sum()` sobre zero linhas devolve `NULL` e sem cast a escala não é
   * garantida: daí o `coalesce(..., 0)::numeric(12,2)`, senão o valor não casa
   * com o `moneySchema` nem com o `formatBRL` (dinheiro é string decimal).
   */
  async totals(orgId: string): Promise<DashboardFinance> {
    const [row] = await this.db
      .select({
        receivable: sql<string>`coalesce(sum(${schema.financialPayments.amount})
          filter (where ${schema.financialPayments.status} <> 'pago'), 0)::numeric(12,2)`,
        received: sql<string>`coalesce(sum(${schema.financialPayments.amount})
          filter (where ${schema.financialPayments.status} = 'pago'), 0)::numeric(12,2)`,
        overdueCount: sql<number>`count(*) filter (
          where ${schema.financialPayments.status} <> 'pago'
            and ${schema.financialPayments.dueDate} < now()
        )::int`,
      })
      .from(schema.financialPayments)
      // financial_payments não tem organizationId — isola pelo lead pai (RNF05).
      .innerJoin(
        schema.leadsBudgets,
        eq(schema.financialPayments.budgetId, schema.leadsBudgets.id)
      )
      .where(eq(schema.leadsBudgets.organizationId, orgId));

    const nextDue = await this.pendingPayments(orgId, DASHBOARD_NEXT_DUE_LIMIT);
    const now = Date.now();

    return {
      receivable: row?.receivable ?? "0.00",
      received: row?.received ?? "0.00",
      overdueCount: row?.overdueCount ?? 0,
      nextDue: nextDue.map((p) => ({
        id: p.id,
        budgetId: p.budgetId,
        customerName: p.customerName,
        dueDate: p.dueDate.toISOString(),
        amount: p.amount,
        isOverdue: p.dueDate.getTime() < now,
      })),
    };
  }

  /** Parcelas ainda não pagas, da mais próxima de vencer para a mais distante. */
  private async pendingPayments(
    orgId: string,
    limit?: number
  ): Promise<UpcomingPayment[]> {
    const query = this.db
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
      .where(
        and(
          eq(schema.leadsBudgets.organizationId, orgId),
          ne(schema.financialPayments.status, "pago")
        )
      )
      .orderBy(asc(schema.financialPayments.dueDate));

    return limit ? query.limit(limit) : query;
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
